import { CivilTime, Course, Enrollment, Homework, School, Studienbuch } from "@stu/core";
import { AccountKey, CryptoSuite } from "@stu/e2ee";
import { Ids } from "@stu/sync";
import {
  DeviceDatabase,
  DeviceSchema,
  type Outbox,
  Ports,
  SyncClient,
  WebSocketTransport,
} from "@stu/sync/client";
import { Faults } from "@stu/sync/lab";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { TabOwner } from "../../infra/device/TabOwner.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { Schema as Device } from "../../infra/sqlite/Schema.ts";
import { LabAccounts } from "./LabAccounts.ts";
import { LabLifecycle } from "./LabLifecycle.ts";

// One virtual device of the Sync Lab: the app's own layers under a name of its own, so it has its
// own OPFS directory, keychain entries, session and engine, and faults on its connection. A crash
// closes the engine's scope and starts it again on the same database. A wipe first deletes what
// the account left on the device, as a reinstall would.

export * as LabDevice from "./LabDevice.ts";

export const Id = Schema.Literals(["a", "b", "c"]);

export type Id = typeof Id.Type;

export interface Spec {
  readonly id: Id;
  readonly persona: LabAccounts.Persona;
  readonly label: string;
}

/** Devices A and B are Lena, as her phone and her laptop would be, and C is her classmate Tom. */
export const specs = {
  a: { id: "a", persona: "lena", label: "Lena, erstes Gerät" },
  b: { id: "b", persona: "lena", label: "Lena, zweites Gerät" },
  c: { id: "c", persona: "tom", label: "Tom" },
} as const satisfies Record<Id, Spec>;

export const ids: ReadonlyArray<Id> = Id.literals;

type Services =
  | SyncClient.Service
  | SqlClient.SqlClient
  | Reactivity.Reactivity
  | Ports.Session
  | CryptoSuite.Service;

export type Engine = Data.TaggedEnum<{
  Starting: {};
  Running: { readonly accountId: string; readonly services: Context.Context<Services> };
  /** The engine didn't start, with the tag of the reason, such as a sign-up the server refused. */
  Failed: { readonly reason: string };
}>;

export const Engine = Data.taggedEnum<Engine>();

/** A homework row as the device shows it, with its course's name and whether it waits. */
export interface Listed extends Homework.Row {
  readonly id: string;
  readonly space: string;
  readonly course: string;
  /** The device's own change, which the server hasn't confirmed yet. */
  readonly waiting: boolean;
}

/** A row the device holds as the server sent it. */
export interface Held {
  readonly space: string;
  readonly id: string;
  readonly version: number;
}

/** What one device holds, read in one transaction. */
export interface Snapshot {
  readonly clientId: string;
  /** The mutation id of the device's newest command, so a forge can aim at the next one. */
  readonly lastMutationId: number;
  readonly today: CivilTime.PlainDate;
  readonly spaces: ReadonlyArray<typeof SyncClient.SyncedSpace.Type>;
  readonly held: ReadonlyArray<Held>;
  readonly homework: ReadonlyArray<Listed>;
  readonly enrollment: Option.Option<Enrollment.Row & { readonly notebook: string }>;
  readonly outbox: ReadonlyArray<Outbox.Command>;
  readonly refusals: ReadonlyArray<Outbox.Rejected>;
}

const rows = <S extends Schema.Top>(schema: S) => Schema.decodeUnknownEffect(Schema.Array(schema));

const decodeMeta = rows(Schema.Struct({ client_id: Schema.String, last_mutation_id: Schema.Int }));

const decodeHeld = rows(
  Schema.Struct({ space: Schema.String, id: Schema.String, version: Schema.Int }),
);

const decodePending = rows(
  Schema.Struct({ space: Schema.String, tbl: Schema.String, id: Schema.String }),
);

const decodeHomework = DeviceSchema.decodeView(Homework.Row);

const decodeEnrollment = DeviceSchema.decodeView(Enrollment.Row);

const decodeCourses = DeviceSchema.decodeView(Course.Row);

const decodeSchools = DeviceSchema.decodeView(School.Row);

const decodeCreate = Schema.decodeUnknownEffect(Homework.create.args);

const encodeDate = Schema.encodeEffect(CivilTime.PlainDate);

const decodeChoice = Schema.decodeEffect(Enrollment.set.args);

/** The time zone of a device without school data yet. */
const fallbackTimeZone = CivilTime.TimeZone.make("Europe/Berlin");

const snapshot = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const db = yield* DeviceDatabase.make;

  const [meta] = yield* Effect.flatMap(
    sql`select client_id, last_mutation_id from sync_meta where id = 1`,
    decodeMeta,
  );

  const held = yield* Effect.flatMap(
    sql`select space, id, version from base_row order by space, id`,
    decodeHeld,
  );

  const pending = yield* Effect.flatMap(sql`select space, tbl, id from pending_row`, decodePending);
  const waiting = new Set(pending.map((row) => `${row.space} ${row.tbl} ${row.id}`));
  const courses = yield* Effect.flatMap(db.select().from(Device.Course), decodeCourses);
  const names = new Map(courses.map((course) => [course.id, course.name]));
  const [school] = yield* Effect.flatMap(db.select().from(Device.School), decodeSchools);

  const [enrollment] = yield* Effect.flatMap(db.select().from(Device.Enrollment), decodeEnrollment);

  const homework = (yield* Effect.flatMap(db.select().from(Device.Homework), decodeHomework))
    .map((row): Listed => ({
      ...row,
      course: names.get(row.courseId) ?? row.courseId,
      waiting: waiting.has(`${row.space} ${Homework.Row.name} ${row.id}`),
    }))
    .sort(Homework.order);

  return {
    clientId: meta?.client_id ?? "",
    lastMutationId: meta?.last_mutation_id ?? 0,
    today: CivilTime.dateIn(yield* Clock.currentTimeMillis, school?.timeZone ?? fallbackTimeZone),
    spaces: yield* SyncClient.spaces.run(),
    held,
    homework,
    enrollment: Option.map(Option.fromNullishOr(enrollment), ({ space, ...row }) => ({
      ...row,
      notebook: space,
    })),
    outbox: yield* SyncClient.pending.run(),
    refusals: yield* SyncClient.refusals.run(),
  } satisfies Snapshot;
});

/** What the device holds now. The views and the engine's tables only change through it. */
const read = Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(snapshot)).pipe(
  Effect.catchTags({ SchemaError: Effect.die }),
);

/** Every table a snapshot reads, so that any write, pull or rebase reads it again. */
const keys = [...Studienbuch.tables.map((table) => table.name), ...Object.values(SyncClient.keys)];

/** The course a forged course choice adds. No school offers it. */
export const notOffered = "lab-nicht-angeboten";

const reasonOf = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);

  if (!Predicate.hasProperty(error, "_tag") || !Predicate.isString(error._tag)) return "Defekt";

  return Predicate.hasProperty(error, "step") && Predicate.isString(error.step)
    ? `${error._tag} (${error.step})`
    : error._tag;
};

/** The device's engine is starting, or didn't start. */
export class NotRunning extends Schema.TaggedError<NotRunning, { readonly brand: unique symbol }>()(
  "LabDevice.NotRunning",
  { device: Id },
) {}

/** The device has no course choice yet: the server hasn't admitted the account, or it never pulled. */
export class NotAdmitted extends Schema.TaggedError<
  NotAdmitted,
  { readonly brand: unique symbol }
>()("LabDevice.NotAdmitted", { device: Id }) {}

/** Starts the device's engine in the background. Its scope ends the device. */
export const make = Effect.fn("LabDevice.make")(function* (spec: Spec) {
  const faults = yield* Faults.make;
  const deviceName = `sync-lab-${spec.id}`;
  const accounts = yield* LabAccounts.Service;

  const device = yield* Layer.build(
    Layer.mergeAll(
      SessionStore.layer,
      AuthApi.layer,
      CryptoSuite.layer,
      Layer.fresh(Reactivity.layer),
    ).pipe(Layer.provideMerge(Layers.device({ name: deviceName, publicComputer: false }))),
  );

  const engine = yield* SubscriptionRef.make<Engine>(Engine.Starting());
  let scope = Option.none<Scope.Closeable>();
  // Starts, crashes and wipes take turns, so two engines never open one database.
  const turns = yield* Semaphore.make(1);

  /** The device's session, signing the persona in when it holds none, and the key it got with it. */
  const session = Effect.gen(function* () {
    const store = yield* SessionStore.Service;
    const current = Option.filter(yield* store.current, (signed) => Option.isSome(signed.token));

    if (Option.isSome(current)) {
      return { accountId: current.value.accountId, rootKey: Option.none<Uint8Array>() };
    }

    const account = yield* accounts.signIn(spec.persona);
    yield* store.signedIn({ accountId: account.accountId, token: account.token, demo: false });

    return { accountId: account.accountId, rootKey: Option.some(account.rootKey) };
  });

  const engineLayer = (accountId: string) =>
    SyncClient.layer(Studienbuch.schema).pipe(
      Layer.provideMerge(
        Layer.effect(Ports.Transport)(Effect.map(Ports.Transport, faults.transport)).pipe(
          Layer.provide(WebSocketTransport.layer),
        ),
      ),
      Layer.provideMerge(SessionStore.session(accountId)),
      Layer.provideMerge(LabLifecycle.layer(faults)),
      Layer.provideMerge(Layers.account(accountId)),
    );

  const start = Effect.gen(function* () {
    const own = yield* Scope.make();

    const built = yield* Effect.exit(
      Effect.gen(function* () {
        const { accountId, rootKey } = yield* session;

        const services = yield* Layer.buildWithScope(engineLayer(accountId), own);

        // A device that just signed in keeps the key as after a demo sign-in. After a crash it
        // holds it already, and a wipe signs in again.
        if (Option.isSome(rootKey)) {
          const keys = yield* AccountKey.derive(Redacted.make(rootKey.value), accountId, 0);
          yield* Context.get(services, SyncClient.Service).unlock(keys);
        }

        return { accountId, services: Context.merge(device, services) };
      }).pipe(Effect.provide(device)),
    );

    if (Exit.isFailure(built)) {
      yield* Scope.close(own, built);

      return yield* SubscriptionRef.set(engine, Engine.Failed({ reason: reasonOf(built.cause) }));
    }

    scope = Option.some(own);
    yield* SubscriptionRef.set(engine, Engine.Running(built.value));
  });

  // Waits for the engine's finalizers: its database worker lets go of the OPFS files only then.
  const stop = Effect.gen(function* () {
    yield* SubscriptionRef.set(engine, Engine.Starting());

    if (Option.isSome(scope)) yield* Scope.close(scope.value, Exit.void);
    scope = Option.none();
  });

  // Asks the session store rather than the engine, so a device whose engine failed to start
  // forgets its account too. Only the tab that owns the device may: another tab's Lab would delete
  // the database this one uses (ADR 0014).
  const forget = Effect.gen(function* () {
    const store = yield* SessionStore.Service;

    yield* TabOwner.own(deviceName);
    yield* stop;

    const signed = yield* store.current;

    if (Option.isSome(signed)) yield* Layers.forget(signed.value.accountId);
    yield* store.forget;
  }).pipe(Effect.provide(device));

  yield* Effect.addFinalizer(() => stop);
  yield* turns.withPermit(start).pipe(Effect.forkScoped);

  /** Runs `effect` on the running engine. It fails while the engine starts or after it failed. */
  const onEngine = Effect.fn("LabDevice.onEngine")(function* <A, E>(
    effect: Effect.Effect<A, E, Services>,
  ) {
    const current = yield* SubscriptionRef.get(engine);

    if (current._tag !== "Running") return yield* new NotRunning({ device: spec.id });

    return yield* Effect.provide(effect, current.services);
  });

  const sync = SyncClient.Service;

  const admitted = Effect.flatMap(onEngine(read), (held) =>
    Option.match(held.enrollment, {
      onNone: () => Effect.fail(new NotAdmitted({ device: spec.id })),
      onSome: (enrollment) => Effect.succeed({ held, enrollment }),
    }),
  );

  /** Adds homework for one of the chosen courses, due in two days. */
  const addHomework = Effect.fn("LabDevice.addHomework")(function* (title: string) {
    const { held, enrollment } = yield* admitted;
    const chosen = enrollment.courseIds;
    const courseId = chosen[held.homework.length % Math.max(1, chosen.length)];

    if (courseId === undefined) return yield* new NotAdmitted({ device: spec.id });

    return yield* onEngine(
      Effect.gen(function* () {
        const args = yield* decodeCreate({
          notebook: enrollment.notebook,
          id: yield* Ids.random,
          courseId,
          title,
          dueOn: yield* encodeDate(CivilTime.addDays(held.today, 2)),
        });

        return yield* (yield* sync).mutate(Homework.create, args);
      }),
    );
  });

  return {
    spec,
    faults,
    engine,

    /** What the device holds, read again after each change to it, across crashes. */
    snapshots: SubscriptionRef.changes(engine).pipe(
      Stream.switchMap((current) =>
        current._tag === "Running"
          ? Reactivity.stream(read, keys).pipe(Stream.provideContext(current.services))
          : Stream.empty,
      ),
    ),

    statuses: SubscriptionRef.changes(engine).pipe(
      Stream.switchMap((current) =>
        current._tag === "Running"
          ? Stream.unwrap(Effect.map(sync, (client) => client.status.changes)).pipe(
              Stream.provideContext(current.services),
            )
          : Stream.empty,
      ),
    ),

    setLatency: (millis: number) => faults.setLatency(Duration.millis(millis)),
    crash: turns.withPermit(Effect.andThen(stop, start)),
    wipe: turns.withPermit(Effect.andThen(forget, start)),
    addHomework,

    /**
     * "In ein anderes Notizbuch senden": a new homework leaves sealed for `space` instead of the
     * device's own notebook, as a modified app would send it. The server answers `Sync.NotMember`.
     * Homework that waited before it goes out as it is.
     */
    sealInto: Effect.fn("LabDevice.sealInto")(function* (space: string) {
      const { held } = yield* admitted;

      yield* faults.forge(Faults.Forge.SealInto({ space, mutationId: held.lastMutationId + 1 }));

      return yield* addHomework("Gehört in ein fremdes Notizbuch");
    }),

    /**
     * "Kurs wählen, der nicht angeboten wird": the device sends its course choice unchanged, and its
     * transport adds a course no school offers, past the device's own checks. The server runs
     * `enrollment.set` again and refuses it, so the choice stays as it was.
     */
    chooseNotOffered: Effect.fn("LabDevice.chooseNotOffered")(function* () {
      const { held, enrollment } = yield* admitted;
      const { notebook, termId, gradeLevel, classId, courseIds } = enrollment;
      const unchanged = { notebook, termId, gradeLevel, courseIds };
      const own = classId === undefined ? unchanged : { ...unchanged, classId };
      const args = yield* decodeChoice(own);

      yield* faults.forge(
        Faults.Forge.RewriteArgs({
          mutator: Enrollment.set.name,
          args: { ...own, courseIds: [...courseIds, notOffered] },
          mutationId: held.lastMutationId + 1,
        }),
      );

      return yield* onEngine(Effect.flatMap(sync, (client) => client.mutate(Enrollment.set, args)));
    }),

    dismiss: (refusal: Outbox.Rejected) =>
      onEngine(Effect.flatMap(sync, (client) => client.dismiss(refusal))),

    /** The device's session token, which the server panel asks with. */
    token: onEngine(Effect.flatMap(Ports.Session, (session) => session.token)),
  };
});

export type LabDevice = Effect.Success<ReturnType<typeof make>>;
