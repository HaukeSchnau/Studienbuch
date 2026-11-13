/**
 * The seeded simulation: steps on a fresh world, invariants after each, then rest and its own
 * invariants. On PGlite a workload sends the same frames and logs the same lines on every run. On
 * PostgreSQL 18 it does the same things, but concurrent answers may arrive in another order.
 */
import { CryptoSuite, SealedRow } from "@stu/e2ee";
import * as Arbitrary from "effect/Arbitrary";
import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Random from "effect/Random";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
import { Outbox } from "../client/Outbox.ts";
import { SyncClient } from "../client/SyncClient.ts";
import { Faults } from "../lab/Faults.ts";
import type { Listener } from "../server/Listener.ts";
import { Pokes } from "../server/Pokes.ts";
import { Spaces } from "../server/Spaces.ts";
import { SyncWriter } from "../server/SyncWriter.ts";
import { Invariants } from "./Invariants.ts";
import { Leaks } from "./Leaks.ts";
import { Planner } from "./Planner.ts";
import { World } from "./World.ts";

export * as Simulation from "./Simulation.ts";

const Device = Schema.Literals(World.deviceIds);

const Course = Schema.Literals([...World.offered, World.unknownCourse]);

/** Which of the device's notes, by position in id order, wrapping around. */
const Pick = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 7 }));

/** Which SQL statement from now a crash comes before, counting from 1. */
const Statement = (maximum: number) => Schema.Int.check(Schema.isBetween({ minimum: 1, maximum }));

export const Add = Schema.TaggedStruct("Add", { device: Device, course: Course });

/** A note step on a device without notes does nothing. */
export const Rename = Schema.TaggedStruct("Rename", { device: Device, pick: Pick });

export const Toggle = Schema.TaggedStruct("Toggle", {
  device: Device,
  pick: Pick,
  done: Schema.Boolean,
});

export const Remove = Schema.TaggedStruct("Remove", { device: Device, pick: Pick });

export const Choose = Schema.TaggedStruct("Choose", {
  device: Device,
  courses: Schema.Array(Course).check(Schema.isMaxLength(3)),
});

/** One round of push and pull, as the engine runs after a connect or a poke. */
export const Sync = Schema.TaggedStruct("Sync", { device: Device });

/**
 * The app comes to the front, which runs a round, time passes as in `Sync`, and the engine crashes
 * before its `statement`th SQL statement. That can be inside any of its transactions. Without that
 * many statements, it crashes once the time is up.
 */
export const CrashDuringSync = Schema.TaggedStruct("CrashDuringSync", {
  device: Device,
  statement: Statement(40),
});

/** The engine stops between two steps. */
export const Crash = Schema.TaggedStruct("Crash", { device: Device });

/** The engine crashes before its `statement`th SQL statement after it started to write a command. */
export const CrashDuringChoose = Schema.TaggedStruct("CrashDuringChoose", {
  device: Device,
  courses: Schema.Array(Course).check(Schema.isMaxLength(3)),
  statement: Statement(20),
});

/**
 * The engine crashes right before its write's command enters the outbox. In one transaction with
 * the write, that leaves nothing; a write split in two would leave its rows without a command.
 */
export const CrashBeforeQueue = Schema.TaggedStruct("CrashBeforeQueue", {
  device: Device,
  courses: Schema.Array(Course).check(Schema.isMaxLength(3)),
});

export const Offline = Schema.TaggedStruct("Offline", { device: Device, offline: Schema.Boolean });

const oneShots = ["dropNextResponse", "duplicateNextPush", "reorderNext"] as const;

export const Fault = Schema.TaggedStruct("Fault", {
  device: Device,
  fault: Schema.Literals(oneShots),
});

export const Latency = Schema.TaggedStruct("Latency", {
  device: Device,
  millis: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2_000 })),
});

/** The network drops every connection of the device, which the server sees as 1006. */
export const Sever = Schema.TaggedStruct("Sever", { device: Device });

/** The device's next `choice.set` names a course the school doesn't offer, past its own check. */
export const ForgeChoice = Schema.TaggedStruct("ForgeChoice", { device: Device });

/**
 * The device's next `choice.set` becomes a command the server can't read, carrying a forged
 * marker: one whose mutator doesn't exist, or whose arguments don't decode. The server must refuse
 * it and store and log nothing of it.
 */
export const ForgeUnreadable = Schema.TaggedStruct("ForgeUnreadable", {
  device: Device,
  unknownMutator: Schema.Boolean,
});

/** The server stops or starts offering a course, as an import would. */
export const Offer = Schema.TaggedStruct("Offer", {
  course: Schema.Literals(World.offered),
  offered: Schema.Boolean,
});

/**
 * The school changes an offer while every device pulls: the import holds `sync_row` until a pull
 * waits for it, so its commit lands between that pull's first and last statement. PGlite has one
 * connection, which a pull would wait for instead, so there it is a plain `Offer`.
 */
export const OfferDuringPulls = Schema.TaggedStruct("OfferDuringPulls", {
  course: Schema.Literals(World.offered),
  offered: Schema.Boolean,
});

/** The user dismisses the device's oldest refusal. */
export const Dismiss = Schema.TaggedStruct("Dismiss", { device: Device });

/** The student leaves the school, losing its courses, or is admitted again. */
export const Admit = Schema.TaggedStruct("Admit", {
  account: Schema.Literals(World.accountIds),
  admitted: Schema.Boolean,
});

/** The device's database is copied, as a phone's nightly backup is. */
export const Backup = Schema.TaggedStruct("Backup", { device: Device });

/**
 * The device's last backup comes back in place of its database, as when a phone is restored. It
 * may then make commands under mutation ids the server already used. Every device has a backup
 * from right after its first sync.
 */
export const Restore = Schema.TaggedStruct("Restore", { device: Device });

/** Time passes. Waiting no time is the padding that shrinking puts in place of a step. */
export const Wait = Schema.TaggedStruct("Wait", {
  millis: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 300_000 })),
});

/** The step that does nothing and that the trace leaves out. */
export const padding = Wait.make({ millis: 0 });

const isPadding = (step: Step) => step._tag === "Wait" && step.millis === 0;

/**
 * The device restarts without the account's root key, as after a start with the keychain locked:
 * it holds back the notes it can't seal yet, and parks what it can't open, until `Unlock`.
 */
export const Lock = Schema.TaggedStruct("Lock", { device: Device });

/** The device gets the account's keys, as from a passkey or the Notfallkarte. */
export const Unlock = Schema.TaggedStruct("Unlock", { device: Device });

/** The device sets the notebook's profile, which every device writes under one id. */
export const Name = Schema.TaggedStruct("Name", { device: Device });

/**
 * Another device of the account, on a build one row format ahead, writes the notebook's profile:
 * every device here holds it unopened, and must not write over it. Nothing happens to a notebook
 * without a key epoch yet.
 */
export const NewerFormat = Schema.TaggedStruct("NewerFormat", {
  account: Schema.Literals(World.accountIds),
});

const noteSteps = [Add, Rename, Toggle, Remove, Name, Lock, Unlock] as const;

const readableSteps = [
  Choose,
  Sync,
  CrashDuringSync,
  Crash,
  CrashDuringChoose,
  CrashBeforeQueue,
  Offline,
  Fault,
  Latency,
  Sever,
  ForgeChoice,
  ForgeUnreadable,
  Offer,
  OfferDuringPulls,
  Dismiss,
  Admit,
  NewerFormat,
  Backup,
  Restore,
  Wait,
] as const;

/** One thing that happens. */
export const Step = Schema.Union([...noteSteps, ...readableSteps]);

export type Step = typeof Step.Type;

export const Workload = Schema.Struct({
  /** Seeds `Random` for everything in the run: ids, client ids, the restore epoch's id. */
  seed: Schema.Int,
  steps: Schema.Array(Step).check(Schema.isMaxLength(60)),
});

export type Workload = typeof Workload.Type;

/** What random workloads draw from: at least 15 steps, so each reaches its faults. */
const Generated = Schema.Struct({
  seed: Schema.Int,
  // `Choose` three times over: it is the one readable command, and most faults act on what
  // commands send.
  steps: Schema.Array(Schema.Union([...noteSteps, Choose, Choose, ...readableSteps])).check(
    Schema.isMinLength(15),
    Schema.isMaxLength(40),
  ),
});

/**
 * Smaller workloads that may fail the same way: the same length, with padding in place of the
 * steps of each half, then each quarter, down to each single step.
 */
const shrink = (workload: Workload): ReadonlyArray<Workload> => {
  const real = workload.steps.flatMap((step, index) => (isPadding(step) ? [] : [index]));
  const candidates: Array<Workload> = [];

  for (
    let size = Math.ceil(real.length / 2);
    size >= 1;
    size = size === 1 ? 0 : Math.ceil(size / 2)
  ) {
    for (let start = 0; start < real.length; start += size) {
      const padded = new Set(real.slice(start, start + size));

      candidates.push({
        ...workload,
        steps: workload.steps.map((step, index) => (padded.has(index) ? padding : step)),
      });
    }
  }

  return candidates;
};

/**
 * Random workloads. A failure shrinks by padding out steps rather than removing them, so the
 * minimum length holds, and the trace shows only the steps left.
 */
export const arbitrary = Arbitrary.schema(Generated, { shrink });

export interface Violation extends Invariants.Violation {
  /**
   * The step after which it showed, counting from 0. `settled` once the world came to rest, and
   * `resumed` once it came to rest again after every device ran one more round.
   */
  readonly step: number | "settled" | "resumed";
}

/** The faults that fire once, and forges, which the result counts. */
export const Counted = Schema.Literals([...oneShots, "forge"]);

export type Counted = typeof Counted.Type;

const isCounted = Schema.is(Counted);

/** Counts of faults armed and fired, all zero. */
export const noFaults = (): Record<Counted, { armed: number; fired: number }> => ({
  dropNextResponse: { armed: 0, fired: 0 },
  duplicateNextPush: { armed: 0, fired: 0 },
  reorderNext: { armed: 0, fired: 0 },
  forge: { armed: 0, fired: 0 },
});

export interface Result {
  /**
   * One line per step with what it did, and one per fault that fired. Every run of the workload
   * behaves the same, so its trace is the same.
   */
  readonly trace: ReadonlyArray<string>;
  readonly violations: ReadonlyArray<Violation>;
  /** How many times a step armed each kind of fault while none was armed, and how often it fired. */
  readonly faults: Readonly<Record<Counted, { readonly armed: number; readonly fired: number }>>;
  /** Every frame either end received, by direction and device, the system identifier replaced. */
  readonly frames: ReadonlyArray<string>;
  /** Every line the server logged and every span it ended, the system identifier replaced. */
  readonly lines: ReadonlyArray<string>;
}

const encodeStep = Schema.encodeEffect(Schema.fromJsonString(Step));

/** How far the clock moves at a time while a step lets the engines work. */
const tick = Duration.millis(50);

/** How long a `Sync` step lets a device work before the next step. */
const syncFor = Duration.seconds(30);

/**
 * How long the world must stay quiet to be at rest: longer than a poke's spread and a write's
 * debounce, so a round a poke or a write asked for has begun.
 */
const calmFor = Duration.seconds(5);

/**
 * How long devices may take to come to rest before they break liveness: the supervisor's longest
 * backoff, 5 minutes, and as long again.
 */
const restLimit = Duration.minutes(10);

/** A fresh note id: random, as encrypted rows' ids are, so the server can't date them. */
const noteId = Effect.map(World.uuid, (id) => `note-${id}`);

/** The id of the device's `pick`th note in id order, if it has any. */
const picked = (device: World.Device, pick: number) =>
  device.sql(device.notes).pipe(
    Effect.map((ids) => (ids.length === 0 ? undefined : ids[pick % ids.length])),
    Effect.orDie,
  );

/** The school's offer of `course` as an import writes it, in the caller's transaction. */
const offer = (change: { readonly course: string; readonly offered: boolean }) =>
  Effect.flatMap(SyncWriter.Service, (writer) =>
    writer.reconcile(
      World.school,
      Planner.Offer,
      change.offered ? [{ id: change.course, row: { name: change.course } }] : [],
      { covers: (entry) => entry.id === change.course },
    ),
  );

const encodeEnvelope = Schema.encodeEffect(
  Schema.fromJsonString(Schema.toCodecJson(SealedRow.Envelope)),
);

/**
 * The notebook's profile as a build one row format ahead writes it, under the notebook's key epoch.
 * This server refuses a format it doesn't know, so the row goes in as a newer server would store
 * it, with a poke. `None` for a notebook without a key epoch.
 */
const newerProfile = Effect.fnUntraced(function* (account: World.Account) {
  const sql = yield* SqlClient.SqlClient;
  const notebook = World.accounts[account];

  const ct = Uint8Array.from(
    yield* Effect.all(Array.from({ length: 64 }, () => Random.nextIntBetween(0, 255))),
  );

  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const [space] = yield* sql<{ readonly epoch: number | null }>`
        select key_epoch as epoch from space where id = ${notebook} for no key update
      `;

      if (space === undefined || space.epoch === null) return Option.none<Invariants.Newer>();

      const [bumped] = yield* sql<{ readonly version: number }>`
        update space set version = version + 1 where id = ${notebook}
        returning version::float8 as version
      `;

      if (bumped === undefined)
        return yield* Effect.die(`The locked space ${notebook} disappeared`);

      const envelope = yield* encodeEnvelope(
        new SealedRow.Envelope({
          format: SealedRow.format + 1,
          suite: CryptoSuite.id,
          keyEpoch: space.epoch,
          author: account,
        }),
      );

      yield* sql`
        insert into sync_row (space_id, tbl, id, version, envelope, ct)
        values (${notebook}, '', ${notebook}, ${bumped.version}, ${envelope}::jsonb, ${ct})
        on conflict (space_id, tbl, id) do update set version = excluded.version, data = null,
          envelope = excluded.envelope, ct = excluded.ct, written_by_client = null,
          written_by_mutation = null
      `;
      yield* Pokes.notify({ spaces: [{ space: notebook, version: bumped.version }], accounts: [] });

      return Option.some({ space: notebook, id: notebook, version: bumped.version });
    }),
  );
});

/** The tables whose rows only devices read. */
const encrypted = Planner.schema.tables.flatMap((table) =>
  table.class === "encrypted" ? [table.name] : [],
);

/** Where the membership rule reads a notebook's chosen courses. */
const choice = { table: Planner.Choice.name, id: Planner.choiceId, kind: Planner.Course.name };

/** What a step's engine call ended with, in a few words for the trace. */
const describe = <A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>,
  success: (value: A) => string,
) =>
  Exit.match(exit, {
    onSuccess: success,
    onFailure: (cause) => {
      if (Cause.hasInterruptsOnly(cause)) return "interrupted";
      const error = Cause.findErrorOption(cause);

      return Option.isSome(error) ? `failed ${error.value._tag}` : "died";
    },
  });

const queued = (mutation: SyncClient.Mutation) => `queued #${mutation.mutationId}`;

interface Client {
  readonly id: string;
  readonly settled: number;
}

/** The mutation id a fired forge went out under, which its event names last. */
const forgedId = (event: Faults.Event) => {
  const id = / on mutation (\d+)$/u.exec(event.detail)?.[1];

  return id === undefined
    ? Effect.die(`A forge's event names no mutation id: ${event.detail}`)
    : Effect.succeed(Number(id));
};

export const run = (workload: Workload) =>
  Effect.gen(function* () {
    const world = yield* World.make;
    // The tables are those of the run's schema, which doesn't change during the run.
    const tables = yield* world.server(Leaks.tables).pipe(Effect.orDie);
    const trace: Array<string> = [];
    const violations: Array<Violation> = [];
    const hung: Array<Invariants.Violation> = [];

    /** The refusals each device's user dismissed, by client id and mutation id. */
    const dismissed = new Map<World.DeviceId, ReadonlySet<string>>(
      World.deviceIds.map((id) => [id, new Set<string>()]),
    );

    /** What each device's user had dismissed when its last backup was made. */
    const dismissedAtBackup = new Map<World.DeviceId, ReadonlySet<string>>();

    /** Moves the simulated clock once the server answered what it was asked. */
    const advance = (by: Duration.Duration) =>
      Effect.andThen(
        Effect.tap(world.quiet, (answered) =>
          Effect.sync(() => {
            if (!answered) {
              hung.push({
                invariant: "liveness",
                place: "server",
                detail: "the database never answered",
              });
            }
          }),
        ),
        TestClock.adjust(by),
      );

    /**
     * Lets simulated time pass until `done` holds or `limit` passed, and says whether it held. The
     * engines' supervisors, timers and latency all run on this clock.
     */
    const until = Effect.fn("Simulation.until")(function* (
      done: Effect.Effect<boolean>,
      limit: Duration.Duration,
      step: Duration.Duration = tick,
    ) {
      for (let waited = 0; waited < Duration.toMillis(limit); waited += Duration.toMillis(step)) {
        if (yield* done) return true;
        yield* advance(step);
      }

      return yield* done;
    });

    let markers = 0;
    let framesChecked = 0;
    let linesChecked = 0;
    const deviceLinesChecked = new Map<World.DeviceId, number>();
    const marker = () => Leaks.marker(markers++);

    const faults = noFaults();

    /** The rows a newer build wrote, by space and id, at the version it wrote last. */
    const newer = new Map<string, Invariants.Newer>();

    /** Each device's client id and the last mutation id it settled, as the last check read them. */
    const clients = new Map<World.DeviceId, Client>();

    /**
     * The newest mutation id the server held under a client id when a device was restored into it
     * with fewer settled. The restored device may make other commands under the ids up to it.
     */
    const restoredBehind = new Map<string, number>();

    const clientOf = (on: World.Device) =>
      on
        .sql(
          Effect.map(Outbox.meta, (meta): Client => ({
            id: meta.clientId,
            settled: meta.settledMutationId,
          })),
        )
        .pipe(Effect.orDie);

    /** The mutation ids each device's fired forges went out under, since its client id changed. */
    const forgedIds = new Map<World.DeviceId, ReadonlyArray<number>>();

    /**
     * Whether the device may have sent two different commands under one id of `client` that it
     * hasn't settled, which makes the server refuse the id: its own after one the server took
     * before a restore, or its own and a forge's in either order.
     */
    const renumberCalledFor = (on: World.DeviceId, client: Client) =>
      (restoredBehind.get(client.id) ?? 0) > client.settled ||
      (forgedIds.get(on) ?? []).some((id) => id > client.settled);

    /** Arms a fault on `on` and counts it, unless one of its kind was armed already. */
    const arm = Effect.fn("Simulation.arm")(function* (
      on: World.Device,
      kind: Counted,
      arming: Effect.Effect<void>,
    ) {
      const before = yield* SubscriptionRef.get(on.faults.settings);
      const armed = kind === "forge" ? Option.isSome(before.forge) : before[kind];

      yield* arming;

      if (armed) return "armed already";
      faults[kind].armed += 1;

      return "armed";
    });

    /** Traces the connections that closed and the faults that fired since the last call. */
    const traceEvents = Effect.gen(function* () {
      for (const close of yield* world.closed) trace.push(`  closed ${close}`);

      for (const each of world.devices.values()) {
        for (const event of yield* each.fired) {
          if (!isCounted(event.fault)) continue;
          faults[event.fault].fired += 1;
          trace.push(`  ${each.id} fired ${event.fault}: ${event.detail}`);

          if (event.fault === "forge") {
            forgedIds.set(each.id, [...(forgedIds.get(each.id) ?? []), yield* forgedId(event)]);
          }
        }
      }
    });

    const device = (id: World.DeviceId) => {
      const found = world.devices.get(id);

      return found === undefined ? Effect.die(`No device ${id}`) : Effect.succeed(found);
    };

    const mutate = <E extends { readonly _tag: string }>(
      on: World.Device,
      run: (sync: SyncClient.Interface) => Effect.Effect<SyncClient.Mutation, E>,
    ) =>
      Effect.map(on.engine(Effect.flatMap(SyncClient.Service, run)), (exit) =>
        describe(exit, queued),
      );

    const choose = (on: World.Device, courses: ReadonlyArray<string>) =>
      mutate(on, (sync) =>
        sync.mutate(Planner.choose, { notebook: on.notebook, school: World.school, courses }),
      );

    /**
     * Whether `idle` holds and still holds after `calmFor`, with nothing run on the server
     * meanwhile. A device waiting out a poke's spread looks idle, so the round the poke asked for
     * shows only as server work. The clock first moves one tick, so a poke on its way lands and its
     * wait starts before the jump.
     */
    const stillIdle = Effect.fn("Simulation.stillIdle")(function* (idle: Effect.Effect<boolean>) {
      if (!(yield* idle)) return false;
      const ran = world.serverLines().length;
      yield* advance(tick);
      yield* advance(calmFor);

      return (yield* idle) && world.serverLines().length === ran;
    });

    /** Lets `on` work until it is idle and stays so, for at most `limit`. */
    const syncing = (on: World.Device, limit: Duration.Duration = syncFor) =>
      Effect.map(until(stillIdle(on.idle), limit), (idle) => (idle ? "idle" : "busy"));

    /** Writes `courses` on `on` and crashes it before the statement `at` names. */
    const crashWhileChoosing = Effect.fnUntraced(function* (
      on: World.Device,
      courses: ReadonlyArray<string>,
      at: number | RegExp,
      named: string,
    ) {
      const last = on
        .sql(Effect.map(Outbox.meta, (meta) => meta.lastMutationId))
        .pipe(Effect.orDie);

      const before = yield* last;
      const stopped = yield* on.stopBefore(at);
      const work = yield* Effect.forkChild(choose(on, courses));

      yield* Effect.raceFirst(Deferred.await(stopped), Fiber.await(work));
      const reached = yield* Deferred.poll(stopped);
      yield* on.crash;
      const outcome = yield* Fiber.join(work);
      const after = yield* last;

      // A write that committed past a named statement without meeting it means its SQL changed.
      if (after > before && Option.isNone(reached) && at instanceof RegExp) {
        return yield* Effect.die(`The write committed without a statement matching ${at}`);
      }

      if (after > before) return `committed #${after}, then crashed`;

      return Option.isSome(reached)
        ? `crashed before ${named} of the write, which queued nothing`
        : `${outcome}, then crashed`;
    });

    const apply = Effect.fnUntraced(function* (step: Step) {
      switch (step._tag) {
        case "Add":
        case "Rename":
        case "Toggle":
        case "Remove": {
          const on = yield* device(step.device);
          const notebook = on.notebook;

          if (step._tag === "Add") {
            const id = yield* noteId;

            return yield* mutate(on, (sync) =>
              sync.mutate(Planner.add, { notebook, id, course: step.course, title: marker() }),
            );
          }

          const id = yield* picked(on, step.pick);

          if (id === undefined) return "no note";

          return yield* mutate(on, (sync) =>
            step._tag === "Rename"
              ? sync.mutate(Planner.rename, { notebook, id, title: marker() })
              : step._tag === "Toggle"
                ? sync.mutate(Planner.toggle, { notebook, id, done: step.done })
                : sync.mutate(Planner.remove, { notebook, id }),
          );
        }

        case "Name": {
          const on = yield* device(step.device);

          return yield* mutate(on, (sync) =>
            sync.mutate(Planner.name, { notebook: on.notebook, name: marker() }),
          );
        }

        case "NewerFormat": {
          const written = yield* world.server(newerProfile(step.account)).pipe(Effect.orDie);

          if (Option.isNone(written)) return "no key epoch yet";
          newer.set(`${written.value.space} ${written.value.id}`, written.value);

          return `wrote v${written.value.version}`;
        }

        case "Lock": {
          const on = yield* device(step.device);
          yield* on.lock;
          const waiting = yield* on.sql(Outbox.pending).pipe(Effect.orDie);
          const kept = waiting.filter((command) => command.sealed !== null).length;

          return `locked, ${kept} sealed ${kept === 1 ? "command" : "commands"} kept`;
        }

        case "Unlock": {
          const on = yield* device(step.device);

          if (yield* on.unlocked) return "unlocked already";

          return describe(yield* on.unlock, () => "unlocked");
        }

        case "Choose":
          return yield* choose(yield* device(step.device), step.courses);

        case "Sync":
          return yield* syncing(yield* device(step.device));

        case "CrashDuringSync": {
          const on = yield* device(step.device);
          const stopped = yield* on.stopBefore(step.statement);
          yield* on.resume;
          const reached = yield* until(Deferred.isDone(stopped), syncFor);
          const inRound = yield* on.syncing;
          const ran = yield* on.statements;
          yield* on.crash;

          if (!reached) return `crashed after ${ran} statements, none of them the stop`;
          const at = yield* Deferred.await(stopped);

          return `crashed before statement ${at.statement}${at.inTransaction ? " in a transaction" : ""}${inRound ? " of a round" : ", between rounds"}`;
        }

        case "CrashDuringChoose":
          return yield* crashWhileChoosing(
            yield* device(step.device),
            step.courses,
            step.statement,
            `statement ${step.statement}`,
          );

        case "CrashBeforeQueue":
          return yield* crashWhileChoosing(
            yield* device(step.device),
            step.courses,
            /^\s*insert into sync_outbox/iu,
            "the outbox insert",
          );

        case "Crash": {
          yield* (yield* device(step.device)).crash;

          return "restarted";
        }

        case "Offline": {
          yield* (yield* device(step.device)).faults.setOffline(step.offline);

          return step.offline ? "offline" : "online";
        }

        case "Fault": {
          const on = yield* device(step.device);

          return yield* arm(on, step.fault, on.faults.arm(step.fault));
        }

        case "Latency": {
          yield* (yield* device(step.device)).faults.setLatency(Duration.millis(step.millis));

          return "set";
        }

        case "Sever": {
          yield* world.network.sever(step.device);

          return "severed";
        }

        case "ForgeChoice": {
          const on = yield* device(step.device);

          // Arguments the server must refuse: a course the school never offers.
          const forge = Faults.Forge.RewriteArgs({
            mutator: Planner.choose.name,
            args: { notebook: on.notebook, school: World.school, courses: [World.unknownCourse] },
          });

          return yield* arm(on, "forge", on.faults.forge(forge));
        }

        case "ForgeUnreadable": {
          const on = yield* device(step.device);
          const leaked = Leaks.forgedMarker(markers++);

          const forge = step.unknownMutator
            ? Faults.Forge.RewriteArgs({
                mutator: Planner.choose.name,
                name: "note.leak",
                args: { title: leaked },
              })
            : Faults.Forge.RewriteArgs({
                mutator: Planner.choose.name,
                args: { notebook: on.notebook, school: World.school, courses: leaked },
              });

          return yield* arm(on, "forge", on.faults.forge(forge));
        }

        case "Offer": {
          yield* world.server(offer(step)).pipe(Effect.orDie);

          return step.offered ? "offered" : "withdrawn";
        }

        case "OfferDuringPulls": {
          const done = step.offered ? "offered" : "withdrawn";

          if (!world.concurrent) {
            yield* world.server(offer(step)).pipe(Effect.orDie);

            return `${done} with no pull alongside, on one connection`;
          }

          const holding = yield* Deferred.make<void>();
          const release = yield* Deferred.make<void>();

          const importing = yield* Effect.forkChild(
            world
              .server(
                Effect.flatMap(SqlClient.SqlClient, (sql) =>
                  sql.withTransaction(
                    Effect.gen(function* () {
                      yield* sql`lock table sync_row in access exclusive mode`;
                      yield* offer(step);
                      yield* Deferred.succeed(holding, undefined);
                      yield* Deferred.await(release);
                    }),
                  ),
                ),
              )
              .pipe(Effect.orDie),
          );

          yield* Deferred.await(holding);

          for (const each of devices) yield* each.resume;

          // The database can't answer the pull until the import commits, so the clock moves
          // without waiting for it here.
          let waited = false;

          for (let ticks = 0; ticks < 600 && !waited; ticks++) {
            yield* TestClock.adjust(tick);
            waited = yield* world.server(Invariants.waitingForRows);
          }

          yield* Deferred.succeed(release, undefined);
          yield* Fiber.join(importing);
          yield* world.quiet;

          return waited ? `${done} while a device waited for it` : `${done}, nothing waited`;
        }

        case "Dismiss": {
          const on = yield* device(step.device);

          const exit = yield* on.engine(
            Effect.gen(function* () {
              const sync = yield* SyncClient.Service;
              const [oldest] = yield* on.sql(SyncClient.refusals.run());

              if (oldest === undefined) return "nothing to dismiss";
              yield* sync.dismiss(oldest);
              const earlier = dismissed.get(on.id) ?? [];
              dismissed.set(
                on.id,
                new Set([...earlier, `${oldest.clientId} ${oldest.mutationId}`]),
              );

              return `dismissed #${oldest.mutationId}`;
            }),
          );

          return describe(exit, (done) => done);
        }

        case "Backup": {
          const on = yield* device(step.device);

          yield* on.backup;
          dismissedAtBackup.set(on.id, dismissed.get(on.id) ?? new Set());

          return "backed up";
        }

        case "Restore": {
          const on = yield* device(step.device);

          if (!(yield* on.restore)) return "no backup";
          dismissed.set(on.id, dismissedAtBackup.get(on.id) ?? new Set());
          yield* world.quiet;
          const restored = yield* clientOf(on);
          const held = yield* world.server(Invariants.lastMutationId(restored.id));

          if (held > restored.settled) restoredBehind.set(restored.id, held);
          clients.set(on.id, restored);
          forgedIds.delete(on.id);

          return "restored the backup";
        }

        case "Admit": {
          yield* world
            .server(
              Effect.flatMap(Spaces.Service, (spaces) =>
                step.admitted
                  ? spaces.addMember(World.school, step.account, "reader")
                  : spaces.removeMember(World.school, step.account),
              ),
            )
            .pipe(Effect.orDie);

          return step.admitted ? "admitted" : "left the school";
        }

        case "Wait": {
          yield* advance(Duration.millis(step.millis));

          return "waited";
        }
      }
    });

    /** What must hold after every step. */
    const check = Effect.gen(function* () {
      const found: Array<Invariants.Violation> = [];

      for (const each of world.devices.values()) {
        const place = `device ${each.id}`;

        found.push(...(yield* each.sql(Invariants.replay(place, Planner.schema, each.account))));
        found.push(...(yield* each.sql(Invariants.gapless(place))));
        found.push(...(yield* each.sql(Invariants.cursors(place))));

        const now = yield* clientOf(each);
        const known = clients.get(each.id) ?? now;

        if (known.id !== now.id) {
          if (!renumberCalledFor(each.id, known)) {
            found.push(Invariants.newClient(place, known.id, now.id));
          }

          forgedIds.delete(each.id);
        }

        clients.set(each.id, now);
      }

      for (const account of World.accountIds) {
        found.push(
          ...(yield* world.server(
            Invariants.courseMembership(account, World.accounts[account], choice),
          )),
        );
      }

      found.push(...(yield* world.server(Invariants.plaintextInPostgres(tables))));
      found.push(...(yield* world.server(Invariants.newerKept([...newer.values()]))));

      for (const leak of yield* world.server(Leaks.sealedRows).pipe(Effect.orDie)) {
        found.push({ invariant: "plaintext", place: leak.place, detail: leak.excerpt });
      }

      const frames = world.frames();

      for (const frame of frames.slice(framesChecked)) {
        found.push(
          ...Invariants.plaintextIn(
            `frame ${frame.direction} device ${frame.device}`,
            Predicate.isString(frame.data) ? frame.data : new TextDecoder().decode(frame.data),
            Leaks.forms,
          ),
        );
      }

      framesChecked = frames.length;
      const lines = world.serverLines();

      for (const line of lines.slice(linesChecked))
        found.push(...Invariants.plaintextIn("server log", line));

      linesChecked = lines.length;

      for (const each of world.devices.values()) {
        const logged = each.lines();

        for (const line of logged.slice(deviceLinesChecked.get(each.id) ?? 0)) {
          found.push(...Invariants.plaintextIn(`device ${each.id} log`, line, Leaks.forms));
        }

        deviceLinesChecked.set(each.id, logged.length);
      }

      found.push(...hung.splice(0));

      return found;
    });

    const devices = [...world.devices.values()];

    const allIdle = Effect.map(
      Effect.forEach(devices, (each) => each.idle),
      (idle) => idle.every(Boolean),
    );

    /** Every device idle, and the server ran nothing for `calmFor`. */
    const calm = stillIdle(allIdle);

    /** Lets every device work until the world is at rest, or breaks liveness. */
    const rest = Effect.fn("Simulation.rest")(function* (label: "settled" | "resumed") {
      if (!(yield* until(calm, restLimit, Duration.seconds(1)))) {
        for (const each of devices) {
          if (!(yield* each.idle)) {
            hung.push({ invariant: "liveness", place: `device ${each.id}`, detail: "never idle" });
          }
        }
      }

      yield* traceEvents;

      for (const each of devices) {
        const state = yield* syncing(each, Duration.zero);
        const refused = yield* each.sql(SyncClient.refusals.run()).pipe(Effect.orDie);
        const shown = refused.map((refusal) => `#${refusal.mutationId} ${refusal.reason._tag}`);

        trace.push(
          `${label} ${each.id} ${state}${shown.length === 0 ? "" : `, refused ${shown.join(", ")}`}`,
        );
      }
    });

    /** What must hold once the world is at rest. */
    const atRest = Effect.gen(function* () {
      const found: Array<Invariants.Violation> = [];

      for (const each of world.devices.values()) {
        const place = `device ${each.id}`;
        const state = yield* each.sql(Invariants.settledState);
        const log = yield* world.server(Invariants.serverLog(state.meta.clientId));

        const own = `${state.meta.clientId} `;

        const dismissedHere = new Set(
          [...(dismissed.get(each.id) ?? [])].flatMap((key) =>
            key.startsWith(own) ? [Number(key.slice(own.length))] : [],
          ),
        );

        found.push(...Invariants.nothingLost(place, state, log, dismissedHere));

        found.push(
          ...Invariants.sameSpaces(
            place,
            yield* each.sql(Invariants.deviceSpaces),
            yield* world.server(Invariants.serverSpaces(each.account)),
          ),
        );

        found.push(
          ...Invariants.converged(
            place,
            yield* each.sql(Invariants.deviceRows(encrypted)),
            yield* world.server(Invariants.serverRows(each.account)),
          ),
        );

        found.push(
          ...Invariants.sealedConverged(
            place,
            yield* each.sql(Invariants.deviceSealed),
            yield* world.server(Invariants.serverSealed(each.account)),
          ),
        );
      }

      // Only devices read sealed rows, so the devices of one account compare what they opened.
      for (const account of World.accountIds) {
        const [first, ...others] = devices.filter((each) => each.account === account);

        if (first === undefined) continue;
        const shown = yield* first.sql(Invariants.openedRows(encrypted));

        for (const other of others) {
          found.push(
            ...Invariants.sameOpened(
              `devices ${first.id} and ${other.id}`,
              shown,
              yield* other.sql(Invariants.openedRows(encrypted)),
            ),
          );
        }
      }

      return found;
    });

    // A device's first sync is its first pull, which tells it the spaces it reads. Its first
    // backup follows, as a phone makes one the first night.
    for (const each of devices) {
      trace.push(`start ${each.id} ${yield* syncing(each)}`);
      yield* each.backup;
      clients.set(each.id, yield* clientOf(each));
    }

    /** What ran over the wire and on the server, comparable across runs and databases. */
    const result = (): Result => ({
      trace,
      violations,
      faults,
      frames: world
        .frames()
        .map(
          (frame) =>
            `${frame.direction} ${frame.device} ${world.normalized(Predicate.isString(frame.data) ? frame.data : new TextDecoder().decode(frame.data))}`,
        ),
      lines: world.serverLines().map(world.normalized),
    });

    for (const [index, step] of workload.steps.entries()) {
      if (isPadding(step)) continue;
      const done = yield* apply(step);
      trace.push(`${index} ${yield* Effect.orDie(encodeStep(step))} ${done}`);
      yield* traceEvents;

      for (const violation of yield* check) violations.push({ ...violation, step: index });

      if (violations.length > 0) return result();
    }

    // Every device back online at full speed and unlocked, however late. What is armed stays
    // armed.
    for (const each of devices) {
      yield* each.faults.setOffline(false);
      yield* each.faults.setLatency(Duration.zero);

      if (!(yield* each.unlocked)) {
        trace.push(`unlock ${each.id} ${describe(yield* each.unlock, () => "unlocked")}`);
      }
    }

    // Nothing pulls on a timer, so a device a poke missed stays behind and shows here.
    yield* rest("settled");

    for (const violation of [...(yield* check), ...(yield* atRest)]) {
      violations.push({ ...violation, step: "settled" });
    }

    if (violations.length > 0) return result();

    // Each app comes to the front once and runs a round, so a fault still armed fires.
    for (const each of devices) yield* each.resume;
    yield* rest("resumed");

    for (const violation of [...(yield* check), ...(yield* atRest)]) {
      violations.push({ ...violation, step: "resumed" });
    }

    return result();
  }).pipe(
    Effect.scoped,
    Random.withSeed(workload.seed),
    // Its warnings come after real time passes, so a loaded machine would log lines an idle one
    // doesn't.
    Effect.provide(TestClock.layer({ warningDelay: Duration.infinity })),
  ) satisfies Effect.Effect<Result, never, SqlClient.SqlClient | Listener.Service>;
