/**
 * One simulated world: the server engine on the given Postgres, and devices running the client
 * engine on in-memory SQLite, connected through the simulated network behind each device's faults.
 * A device's database and secrets outlive its engine, so a crash interrupts the engine and its
 * calls wherever they are, and a restart resumes on the same database.
 */
import { eq } from "drizzle-orm";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Random from "effect/Random";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Redacted from "effect/Redacted";
import * as Scope from "effect/Scope";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { DeviceDatabase } from "../client/DeviceDatabase.ts";
import { Devices } from "../client/fixture/Devices.ts";
import { Ports as ClientPorts } from "../client/Ports.ts";
import { SyncClient } from "../client/SyncClient.ts";
import { Faults } from "../lab/Faults.ts";
import type { Connections } from "../server/Connections.ts";
import { Fixture } from "../server/Fixture.ts";
import { Listener } from "../server/Listener.ts";
import { Ports } from "../server/Ports.ts";
import { ServerDatabase } from "../server/ServerDatabase.ts";
import { Spaces } from "../server/Spaces.ts";
import { SyncEpoch } from "../server/SyncEpoch.ts";
import { SyncServer } from "../server/SyncServer.ts";
import { SyncWriter } from "../server/SyncWriter.ts";
import { DeviceSqlite } from "./DeviceSqlite.ts";
import PlannerMigrations from "./migrations/migrations.js";
import { Network } from "./Network.ts";
import { Planner } from "./Planner.ts";
import { PlannerDevice } from "./PlannerDevice.ts";
import { Recorder } from "./Recorder.ts";

export * as World from "./World.ts";

export const school = "school-1";

/** The courses the school offers at the start, and one it never offers. */
export const offered = ["course-ma", "course-de", "course-bio"] as const;

export const unknownCourse = "course-gone";

/** Lena reads and writes her notebook on devices `a` and `b`, Tom his on `c`. */
export const accounts = { lena: "notebook-lena", tom: "notebook-tom" } as const;

export type Account = keyof typeof accounts;

export const deviceIds = ["a", "b", "c"] as const;

export type DeviceId = (typeof deviceIds)[number];

export const devices: Readonly<Record<DeviceId, Account>> = { a: "lena", b: "lena", c: "tom" };

export interface Device {
  readonly id: DeviceId;
  readonly account: Account;
  readonly notebook: string;
  readonly faults: Faults.Faults;
  /** The faults that fired since the last call, oldest first. */
  readonly fired: Effect.Effect<ReadonlyArray<Faults.Event>>;
  /** Runs an effect on the device's database. */
  readonly sql: <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A, E>;
  /** The ids of the notes the device shows, in id order. */
  readonly notes: Effect.Effect<ReadonlyArray<string>, never, SqlClient.SqlClient>;
  /**
   * Runs an effect with the device's engine, as part of the engine: a crash interrupts it, as a
   * crash ends what the app was doing.
   */
  readonly engine: <A, E>(
    effect: Effect.Effect<A, E, SyncClient.Service>,
  ) => Effect.Effect<Exit.Exit<A, E>>;
  /** Whether the engine is online and has nothing to push, pull or wait for. */
  readonly idle: Effect.Effect<boolean>;
  /** Interrupts the engine wherever it is and starts a new one on the same database. */
  readonly crash: Effect.Effect<void>;
}

/** A UUIDv4 from `Random`, so a seeded run names everything the same way. */
export const uuid = Effect.gen(function* () {
  const hex: Array<string> = [];

  for (let index = 0; index < 16; index++) {
    hex.push((yield* Random.nextIntBetween(0, 255)).toString(16).padStart(2, "0"));
  }

  const text = hex.join("");

  return `${text.slice(0, 8)}-${text.slice(8, 12)}-4${text.slice(13, 16)}-a${text.slice(17, 20)}-${text.slice(20)}`;
});

/**
 * The engine's tables, empty, so one PGlite serves every run of a test file. The first run creates
 * them. Later runs empty them, which takes milliseconds where drizzle-kit's statements take seconds.
 */
const resetServer = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const tables = yield* sql<{ readonly name: string }>`
    select tablename as name from pg_tables where schemaname = 'public' order by tablename
  `;

  if (tables.length === 0) {
    yield* ServerDatabase.create;
  } else {
    yield* sql.unsafe(
      `truncate ${tables.map(({ name }) => `"${name.replaceAll('"', '""')}"`).join(", ")} cascade`,
    );
    yield* SyncEpoch.initialize;
  }

  // `gen_random_uuid` wrote the id. A seeded run needs its own, because pulls carry it.
  yield* sql`update sync_epoch set id = ${yield* uuid}`;
});

/** The school, its courses, the two notebooks and their owners, as admission would leave them. */
const seedServer = Effect.gen(function* () {
  const spaces = yield* Spaces.Service;
  const writer = yield* SyncWriter.Service;

  yield* spaces.create(school, Planner.School);

  for (const course of offered) {
    yield* spaces.create(course, Planner.Course, { parent: school, key: course });
    yield* writer.reconcile(course, Planner.Topic, [{ id: "topic-1", row: { title: course } }]);
  }

  yield* writer.reconcile(
    school,
    Planner.Offer,
    offered.map((course) => ({ id: course, row: { name: course } })),
  );

  for (const [account, notebook] of Object.entries(accounts)) {
    yield* spaces.create(notebook, Planner.Notebook, { parent: school });
    yield* spaces.addMember(notebook, account, "owner");
    yield* spaces.addMember(school, account, "reader");
  }
});

/** What outlives the engine: the database and the secrets, as on a phone's disk and keychain. */
const devicePlatform = Layer.effectDiscard(
  Effect.orDie(DeviceDatabase.migrate(PlannerMigrations.migrations)),
).pipe(
  Layer.provideMerge(Layer.effect(SqlClient.SqlClient, DeviceSqlite.make)),
  Layer.provideMerge(Reactivity.layer),
  Layer.provideMerge(Devices.secrets),
  Layer.provideMerge(Devices.crypto),
  Layer.orDie,
);

/**
 * Signed in for good. The supervisor connects only with a token, and the simulation's transport
 * needs no ticket, so the token is never read.
 */
const session = (account: Account) => {
  const token = Option.some(Redacted.make(`token-${account}`));

  return Layer.succeed(ClientPorts.Session, {
    accountId: account,
    token: Effect.succeed(token),
    changes: Stream.concat(Stream.make(token), Stream.never),
    ended: Effect.void,
  });
};

/** The server's side of one connection, as its WebSocket route runs it after the ticket. */
const serve =
  (server: Context.Context<Connections.Service>, recorder: Recorder.Recorder): Network.Serve =>
  (resolved, socket) =>
    SyncServer.connection(resolved, socket).pipe(
      Effect.provide(Layer.merge(Layer.succeedContext(server), recorder.layer)),
    );

/** Nobody signs in over HTTP in the simulation, so no session resolves and none is revoked. */
const sessions = Layer.succeed(
  Ports.SessionResolver,
  Ports.SessionResolver.of({ resolve: () => Effect.succeedNone, revoked: Stream.never }),
);

const makeDevice = Effect.fnUntraced(function* (id: DeviceId, network: Network.Network) {
  const account = devices[id];
  const notebook = accounts[account];
  const platform = yield* Layer.build(devicePlatform);
  const faults = yield* Faults.make;
  const events = yield* faults.subscribe;

  const sql = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
    Effect.provide(effect, platform);

  const transport = faults.transport(
    network.transport({
      id,
      session: {
        accountId: account,
        sessionId: `session-${id}`,
        expiresAt: DateTime.makeUnsafe("2100-01-01T00:00:00Z"),
      },
    }),
  );

  // The platform reports the network as the device's faults set it, and the app as in front.
  const lifecycle = Layer.succeed(ClientPorts.Lifecycle, {
    changes: SubscriptionRef.changes(faults.settings).pipe(
      Stream.map(({ offline }) => ({ foreground: true, online: !offline })),
      Stream.changesWith((before, after) => before.online === after.online),
    ),
  });

  const engineLayer = SyncClient.layer(Planner.schema).pipe(
    Layer.provide(
      Layer.mergeAll(
        session(account),
        lifecycle,
        Layer.succeed(ClientPorts.Transport, transport),
        Layer.succeedContext(platform),
      ),
    ),
  );

  const start = Effect.gen(function* () {
    const scope = yield* Scope.make();
    const context = yield* Layer.buildWithScope(engineLayer, scope);

    return { scope, context };
  }).pipe(Effect.orDie);

  let running = yield* start;

  yield* Effect.addFinalizer(() => Scope.close(running.scope, Exit.void));

  const engine = <A, E>(effect: Effect.Effect<A, E, SyncClient.Service>) =>
    Effect.suspend(() =>
      Effect.provideService(
        effect,
        SyncClient.Service,
        Context.get(running.context, SyncClient.Service),
      ).pipe(Effect.forkIn(running.scope), Effect.flatMap(Fiber.await)),
    );

  const device: Device = {
    id,
    account,
    notebook,
    faults,
    fired: PubSub.takeUpTo(events, Number.MAX_SAFE_INTEGER),
    sql,
    notes: Effect.gen(function* () {
      const db = yield* DeviceDatabase.make;
      const { Note } = PlannerDevice;

      const rows = yield* db
        .select({ id: Note.id })
        .from(Note)
        .where(eq(Note.space, notebook))
        .orderBy(Note.id);

      return rows.map((row) => row.id);
    }).pipe(Effect.orDie),
    engine,
    idle: Effect.suspend(() =>
      Effect.map(
        Context.get(running.context, SyncClient.Service).status.get,
        (status) =>
          status.connection === "online" &&
          !status.pushing &&
          !status.pulling &&
          status.waiting === 0,
      ),
    ),
    crash: Effect.suspend(() =>
      Effect.andThen(Scope.close(running.scope, Exit.interrupt()), start).pipe(
        Effect.tap((started) =>
          Effect.sync(() => {
            running = started;
          }),
        ),
        Effect.asVoid,
      ),
    ),
  };

  return device;
});

/** A world on the server `SqlClient` in context, whose tables it replaces. */
export const make = Effect.gen(function* () {
  yield* resetServer.pipe(Effect.orDie);
  const recorder = yield* Recorder.make;
  const frames: Array<Network.Frame> = [];

  const server = yield* Layer.build(
    SyncServer.layer(Planner.schema).pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          sessions,
          Fixture.crypto,
          Devices.crypto,
          Layer.succeed(Listener.Service)(yield* Listener.Service),
          Layer.succeed(SqlClient.SqlClient)(yield* SqlClient.SqlClient),
        ),
      ),
    ),
  );

  yield* Effect.provide(seedServer, server).pipe(Effect.orDie);

  const network = yield* Network.make(serve(server, recorder), (frame) =>
    Effect.sync(() => {
      frames.push(frame);
    }),
  );

  const all = yield* Effect.forEach(deviceIds, (id) => makeDevice(id, network));

  return {
    devices: new Map(all.map((device) => [device.id, device])),
    network,
    /** Every frame either end received so far, in order. */
    frames: (): ReadonlyArray<Network.Frame> => frames,
    /** Every line the server logged and every span it ended so far. */
    serverLines: recorder.lines,
    /** Runs an effect against the server engine. */
    server: <A, E>(
      effect: Effect.Effect<A, E, Spaces.Service | SyncWriter.Service | SqlClient.SqlClient>,
    ) => Effect.provide(effect, server),
  };
});

export type World = Effect.Success<typeof make>;
