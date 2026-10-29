/**
 * One simulated world: the server engine on the given Postgres, and devices running the client
 * engine on in-memory SQLite, connected through the simulated network behind each device's faults.
 * A device's database and secrets outlive its engine, so a crash interrupts the engine and its
 * calls wherever they are, and a restart resumes on the same database.
 */
import { eq } from "drizzle-orm";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
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

export const accountIds = ["lena", "tom"] as const satisfies ReadonlyArray<Account>;

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
  /** Whether a round is pushing or pulling. */
  readonly syncing: Effect.Effect<boolean>;
  /** The app goes to the background and comes back at once, which runs a round. */
  readonly resume: Effect.Effect<void>;
  /**
   * Stops the engine before the `at`th SQL statement from now, or the first whose SQL `at` matches,
   * which then waits for a crash to end it. The result completes there.
   */
  readonly stopBefore: (at: number | RegExp) => Effect.Effect<Deferred.Deferred<Stopped>>;
  /** How many statements ran since the last `stopBefore`. */
  readonly statements: Effect.Effect<number>;
  /**
   * Interrupts the engine wherever it is and starts a new one on the same database. Its
   * connections drop without a close frame, as a dead process's do, so the server sees 1006.
   */
  readonly crash: Effect.Effect<void>;
  /** Copies the device's database, as a phone's backup does. */
  readonly backup: Effect.Effect<void>;
  /** Crashes, puts the last backup's database back and starts again. `false` without a backup. */
  readonly restore: Effect.Effect<boolean>;
}

/** Where a device's engine was when it stopped before a statement. */
export interface Stopped {
  /** Counting from 1 when the stop was set. */
  readonly statement: number;
  readonly inTransaction: boolean;
}

/** How many scheduler turns `quiet` waits for the database: a minute or so on a loaded machine. */
const patientTurns = 5_000_000;

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
const devicePlatform = (before: DeviceSqlite.Before) =>
  Layer.effectDiscard(Effect.orDie(DeviceDatabase.migrate(PlannerMigrations.migrations))).pipe(
    Layer.provideMerge(Layer.effect(SqlClient.SqlClient, DeviceSqlite.make(before))),
    Layer.provideMerge(Reactivity.layer),
    Layer.provideMerge(Devices.secrets),
    Layer.provideMerge(Devices.crypto),
    Layer.orDie,
  );

/** A value SQLite stores. */
type Cell = string | number | bigint | Uint8Array | null;

/** Every table's rows, as a backup of the device's database holds them. */
const dump = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const tables = yield* sql<{ readonly name: string }>`
    select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name
  `;

  return yield* Effect.forEach(tables, ({ name }) =>
    Effect.map(sql<Readonly<Record<string, Cell>>>`select * from ${sql(name)}`, (rows) => ({
      name,
      rows,
    })),
  );
}).pipe(Effect.orDie);

type Backup = Effect.Success<typeof dump>;

/** Puts a backup's rows back in place of every table's. */
const load = (backup: Backup) =>
  Effect.flatMap(SqlClient.SqlClient, (sql) =>
    sql.withTransaction(
      Effect.forEach(
        backup,
        ({ name, rows }) =>
          Effect.andThen(
            sql`delete from ${sql(name)}`,
            rows.length === 0
              ? Effect.void
              : Effect.asVoid(sql`insert into ${sql(name)} ${sql.insert(rows)}`),
          ),
        { discard: true },
      ),
    ),
  ).pipe(Effect.orDie);

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
  (server: Context.Context<Connections.Service>): Network.Serve =>
  (resolved, socket) =>
    Effect.provide(SyncServer.connection(resolved, socket), server);

/** Nobody signs in over HTTP in the simulation, so no session resolves and none is revoked. */
const sessions = Layer.succeed(
  Ports.SessionResolver,
  Ports.SessionResolver.of({ resolve: () => Effect.succeedNone, revoked: Stream.never }),
);

const makeDevice = Effect.fnUntraced(function* (id: DeviceId, network: Network.Network) {
  const account = devices[id];
  const notebook = accounts[account];
  let statements = 0;
  let inTransaction = false;

  let stop:
    | { readonly at: number | RegExp; readonly stopped: Deferred.Deferred<Stopped> }
    | undefined;

  // Counts statements, follows the transaction and stops where `stopBefore` asked.
  const before = (text: string) =>
    Effect.suspend(() => {
      statements += 1;

      const reached =
        stop !== undefined &&
        (stop.at instanceof RegExp ? stop.at.test(text) : statements >= stop.at);

      if (stop !== undefined && reached) {
        const { stopped } = stop;
        stop = undefined;

        // Interruptible even where the SQL client masks interruption, around BEGIN and COMMIT.
        return Effect.andThen(
          Deferred.succeed(stopped, { statement: statements, inTransaction }),
          Effect.interruptible(Effect.never),
        );
      }

      const head = text.trimStart().toUpperCase();

      if (head.startsWith("BEGIN")) inTransaction = true;
      else if (head.startsWith("COMMIT") || /^ROLLBACK(?! TO)/u.test(head)) inTransaction = false;

      return Effect.void;
    });

  const platform = yield* Layer.build(devicePlatform(before));

  const faults = yield* Faults.make.pipe(
    Effect.provideService(Faults.Allowed, { environment: "development" }),
  );

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

  const foreground = yield* SubscriptionRef.make(true);

  // The platform reports the network as the device's faults set it, and the app in front unless
  // `resume` sends it away for a moment.
  const lifecycle = Layer.succeed(ClientPorts.Lifecycle, {
    changes: Stream.zipLatestWith(
      SubscriptionRef.changes(faults.settings),
      SubscriptionRef.changes(foreground),
      (settings, inFront) => ({ foreground: inFront, online: !settings.offline }),
    ).pipe(
      Stream.changesWith(
        (before, after) => before.online === after.online && before.foreground === after.foreground,
      ),
    ),
  });

  // Without the periodic pull only pokes and writes run rounds, so a lost poke leaves the device
  // behind instead of being covered by the timer.
  const engineLayer = SyncClient.layer(Planner.schema, { pullEvery: Duration.infinity }).pipe(
    Layer.provide(
      Layer.mergeAll(
        session(account),
        lifecycle,
        Layer.succeed(ClientPorts.Transport, transport),
        Layer.succeedContext(platform),
      ),
    ),
    Layer.provideMerge(Recorder.deviceTracer),
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
      Effect.provide(effect, running.context).pipe(
        Effect.forkIn(running.scope),
        Effect.flatMap(Fiber.await),
      ),
    );

  const status = Effect.suspend(() => Context.get(running.context, SyncClient.Service).status.get);

  const restart = Effect.tap(start, (started) =>
    Effect.sync(() => {
      running = started;
    }),
  );

  // A transaction a crash left open rolls back when the app opens its database again, as
  // SQLite's journal does. The client rolls back itself unless the crash stopped its COMMIT.
  const rollBack = Effect.suspend(() =>
    inTransaction
      ? sql(Effect.flatMap(SqlClient.SqlClient, (client) => client.unsafe("ROLLBACK"))).pipe(
          Effect.orDie,
          Effect.asVoid,
        )
      : Effect.void,
  );

  const kill = Effect.suspend(() => {
    stop = undefined;

    return network
      .sever(id)
      .pipe(Effect.andThen(Scope.close(running.scope, Exit.interrupt())), Effect.andThen(rollBack));
  });

  let backup: Backup | undefined;

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
    idle: Effect.map(
      status,
      (now) => now.connection === "online" && !now.pushing && !now.pulling && now.waiting === 0,
    ),
    syncing: Effect.map(status, (now) => now.pushing || now.pulling),
    resume: Effect.andThen(
      SubscriptionRef.set(foreground, false),
      SubscriptionRef.set(foreground, true),
    ),
    stopBefore: (at) =>
      Effect.tap(Deferred.make<Stopped>(), (stopped) =>
        Effect.sync(() => {
          statements = 0;
          stop = { at, stopped };
        }),
      ),
    statements: Effect.sync(() => statements),
    crash: Effect.asVoid(Effect.andThen(kill, restart)),
    backup: Effect.flatMap(sql(dump), (copy) =>
      Effect.sync(() => {
        backup = copy;
      }),
    ),
    restore: Effect.suspend(() => {
      const copy = backup;

      if (copy === undefined) return Effect.succeed(false);

      return kill.pipe(Effect.andThen(sql(load(copy))), Effect.andThen(restart), Effect.as(true));
    }),
  };

  return device;
});

/** A world on the server `SqlClient` in context, whose tables it replaces. */
export const make = Effect.gen(function* () {
  yield* resetServer.pipe(Effect.orDie);
  const recorder = yield* Recorder.make;
  const frames: Array<Network.Frame> = [];

  // The recorder's logger and tracer reach everything the server runs: connections, imports,
  // writes from the steps.
  const server = yield* Layer.build(
    SyncServer.layer(Planner.schema).pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          sessions,
          Fixture.crypto,
          Fixture.accountKeys,
          Devices.crypto,
          Layer.succeed(Listener.Service)(yield* Listener.Service),
          Layer.succeed(SqlClient.SqlClient)(yield* SqlClient.SqlClient),
          recorder.layer,
        ),
      ),
    ),
  );

  // A fresh cluster has its own identifier, which the restore epoch carries.
  const [system] = yield* Effect.provide(
    Effect.flatMap(
      SqlClient.SqlClient,
      (sql) =>
        sql<{ readonly id: string }>`select system_identifier::text as id from pg_control_system()`,
    ),
    server,
  ).pipe(Effect.orDie);

  yield* Effect.provide(seedServer, server).pipe(Effect.orDie);

  const closes: Array<string> = [];

  const network = yield* Network.make(
    serve(server),
    (frame) =>
      Effect.sync(() => {
        frames.push(frame);
      }),
    (device, code) =>
      Effect.sync(() => {
        closes.push(`${device} ${code}`);
      }),
  );

  const all = yield* Effect.forEach(deviceIds, (id) => makeDevice(id, network));

  return {
    devices: new Map(all.map((device) => [device.id, device])),
    network,
    /** Every frame either end received so far, in order. */
    frames: (): ReadonlyArray<Network.Frame> => frames,
    /** Each connection that closed since the last call, as its device and close code. */
    closed: Effect.sync(() => closes.splice(0)),
    /** Every line the server logged and every span it ended so far. */
    serverLines: recorder.lines,
    /** Whether the database serves more than one connection at once, as PostgreSQL does. */
    concurrent: (yield* SqlClient.SqlClient).driver !== "pglite",
    /** `text` with the database's system identifier replaced, so runs on two databases compare. */
    normalized: (text: string) =>
      system === undefined ? text : text.replaceAll(system.id, "<system identifier>"),
    /**
     * Waits until no server SQL is in flight, and says whether that came. A real database answers
     * in real time, which the simulated clock must not run ahead of, or a slow machine would see
     * timeouts a fast one doesn't. A database that never answers gives up after many turns.
     */
    quiet: Effect.gen(function* () {
      for (let calm = 0, turns = 0; calm < 3; turns++) {
        if (turns > patientTurns) return false;
        yield* Effect.yieldNow;
        calm = recorder.sqlInFlight() === 0 ? calm + 1 : 0;
      }

      return true;
    }),
    /** Runs an effect against the server engine. */
    server: <A, E>(
      effect: Effect.Effect<A, E, Spaces.Service | SyncWriter.Service | SqlClient.SqlClient>,
    ) => Effect.provide(effect, server),
  };
});

export type World = Effect.Success<typeof make>;
