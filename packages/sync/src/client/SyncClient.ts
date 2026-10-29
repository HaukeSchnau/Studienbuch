/**
 * The device engine, one per device database. A screen writes through `mutate` and reads through
 * `SyncQuery` over the views. A write lands in the overlay (`pending_row`) and the outbox in one
 * transaction, so it shows at once and survives a crash, and the server confirms or refuses it
 * later. A refusal stays in `refusals` with its reason until the user dismisses or redoes it.
 *
 * ```ts
 * const sync = yield* SyncClient.Service
 * const { confirmed } = yield* sync.mutate(Homework.create, { notebook, id, courseId, title, dueOn })
 * ```
 */
import { CryptoSuite } from "@stu/e2ee";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";
import * as PubSub from "effect/PubSub";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Sync } from "../definition/Sync.ts";
import { Ids } from "../protocol/Ids.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { Tx } from "../transaction/Tx.ts";
import { DeviceSchema } from "./DeviceSchema.ts";
import { Outbox } from "./Outbox.ts";
import { Ports } from "./Ports.ts";
import { Rebase } from "./Rebase.ts";
import { Replication } from "./Replication.ts";
import { SqliteTx } from "./SqliteTx.ts";
import { Supervisor } from "./Supervisor.ts";
import type { SyncQuery } from "./SyncQuery.ts";

export * as SyncClient from "./SyncClient.ts";

/** The server refused the command. Its effect has left the device, and `refusals` lists it. */
export class Rejected extends Schema.TaggedError<Rejected, { readonly brand: unique symbol }>()(
  "SyncClient.Rejected",
  { mutationId: Ids.MutationId, reason: Refusal.Reason },
) {}

export interface Mutation {
  readonly mutationId: number;
  /**
   * Completes once the server applied the command, or fails with its refusal. Most screens ignore
   * it. It lives in memory, so it never completes for a command whose device restarted since.
   */
  readonly confirmed: Effect.Effect<void, Rejected>;
}

/**
 * Why a command never entered the outbox: the mutator's own refusal, a `Tx` error, a space the
 * device doesn't know or a role that may not write there, or arguments its codec refuses.
 */
export type MutateError<E> =
  | E
  | Tx.Error
  | Refusal.NotMember
  | Refusal.NotAllowed
  | Refusal.InvalidArgs;

export interface Status {
  /** Whether the engine has a connection to the server. */
  readonly connection: "offline" | "connecting" | "online";
  readonly pushing: boolean;
  readonly pulling: boolean;
  /** Commands the server hasn't settled. A device is idle when it is online and none is in flight. */
  readonly waiting: number;
  /** The server needs a newer app. The device keeps working on its own data and keeps its outbox. */
  readonly updateRequired: Option.Option<Replication.UpdateRequired>;
  /** Another device removed this one, and the engine wiped its data and keys. */
  readonly revoked: boolean;
}

export interface Interface {
  /**
   * Runs the mutator on the device and queues the command, or fails and queues nothing. Returns
   * once the local transaction committed.
   */
  readonly mutate: <
    Args,
    E extends { readonly _tag: string },
    Writes extends ReadonlyArray<Sync.Any>,
  >(
    mutator: Sync.Mutator<string, Args, E, Writes>,
    args: Args,
  ) => Effect.Effect<Mutation, MutateError<E>>;
  /**
   * Runs a refused command again from its stored arguments and drops the refusal, in one
   * transaction. `None` when the refusal is gone already, as after a second tap. When the run
   * fails, the refusal stays.
   */
  readonly redo: (
    rejected: Pick<Outbox.Rejected, "clientId" | "mutationId">,
  ) => Effect.Effect<
    Option.Option<Mutation>,
    MutateError<{ readonly _tag: string }> | Refusal.UnknownMutator
  >;
  readonly dismiss: (
    rejected: Pick<Outbox.Rejected, "clientId" | "mutationId">,
  ) => Effect.Effect<void, SqlError.SqlError>;
  readonly status: {
    readonly get: Effect.Effect<Status>;
    /** The status now, then each change. */
    readonly changes: Stream.Stream<Status>;
  };
  /**
   * The offline latch, for the Sync Lab, tests and native E2E: while set, the device disconnects,
   * stays disconnected and keeps working on its own data.
   */
  readonly setOffline: (offline: boolean) => Effect.Effect<void>;
  /**
   * One round of push and pull over a connection. The connection supervisor runs it after each
   * connect and after pokes; a second round waits for the first.
   */
  readonly replicate: (
    remote: Replication.Remote,
  ) => Effect.Effect<Replication.Outcome, Replication.Disconnected | SqlError.SqlError>;
}

export class Service extends Context.Service<Service, Interface>()("@stu/sync/client/SyncClient") {}

/** The `Reactivity` keys of the engine's own queries. Synced tables use their names as keys. */
export const keys = DeviceSchema.keys;

/** The device's refused commands, oldest first. */
export const refusals: SyncQuery.SyncQuery<void, Outbox.Rejected, SqlError.SqlError> = {
  keys: [keys.refusals],
  run: () => Outbox.rejected,
};

/** The commands waiting for the server, oldest first, as the Sync Lab lists them. */
export const pending: SyncQuery.SyncQuery<void, Outbox.Command, SqlError.SqlError> = {
  keys: [keys.outbox],
  run: () => Outbox.pending,
};

/** A space the account reads, and when the device last pulled ("zuletzt synchronisiert"). */
export const SyncedSpace = Schema.Struct({
  id: Schema.String,
  kind: Schema.String,
  role: Schema.String,
  syncedAt: Schema.NullOr(Schema.DateTimeUtcFromMillis),
});

const decodeSynced = Schema.decodeUnknownEffect(Schema.Array(SyncedSpace));

/** The spaces the account reads as of the last pull, apart from the connection's state. */
export const spaces: SyncQuery.SyncQuery<
  void,
  typeof SyncedSpace.Type,
  SqlError.SqlError | Schema.SchemaError
> = {
  keys: [keys.spaces],
  run: () =>
    Effect.flatMap(SqlClient.SqlClient, (sql) =>
      Effect.flatMap(
        sql`select id, kind, role, synced_at as "syncedAt" from sync_space order by id`,
        decodeSynced,
      ),
    ),
};

const isId = Schema.is(Ids.Id);

const encodeRevoked = Schema.encodeEffect(Protocol.DeviceRevoked);

const SpaceRow = Schema.Struct({ id: Schema.String, kind: Schema.String, role: Schema.String });

const decodeSpaces = Schema.decodeUnknownEffect(Schema.Array(SpaceRow));

/** The kind and the account's role of each of `spaces` that the device knows. */
const knownSpaces = Effect.fnUntraced(function* (spaces: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;

  if (spaces.length === 0) return new Map<string, typeof SpaceRow.Type>();

  const rows = yield* Effect.orDie(
    decodeSpaces(yield* sql`select id, kind, role from sync_space where ${sql.in("id", spaces)}`),
  );

  return new Map(rows.map((row) => [row.id, row]));
});

export const make = Effect.fnUntraced(function* (definition: Sync.Definition) {
  yield* Effect.orDie(Effect.fromResult(Sync.validate(definition)));
  const sql = yield* SqlClient.SqlClient;
  const reactivity = yield* Reactivity.Reactivity;
  const actor = (yield* Ports.Session).accountId;
  /** Tells the supervisor that a command waits. */
  const writes = yield* PubSub.sliding<void>(1);
  const offline = yield* SubscriptionRef.make(false);
  const secrets = yield* Ports.DeviceSecrets;
  const suite = yield* CryptoSuite.Service;
  const transport = yield* Ports.Transport;
  const lifecycle = yield* Ports.Lifecycle;
  const session = yield* Ports.Session;

  yield* Outbox.start(yield* Ids.random);

  const status = yield* SubscriptionRef.make<Status>({
    connection: "offline",
    pushing: false,
    pulling: false,
    waiting: yield* Outbox.waiting,
    updateRequired: Option.none(),
    revoked: false,
  });

  /**
   * The `confirmed` handles of commands the server hasn't settled, by client id and mutation id. A
   * command whose transaction rolled back leaves its handle behind until the next takes its id.
   */
  const waiters = new Map<
    string,
    { readonly mutationId: number; readonly deferred: Deferred.Deferred<void, Rejected> }
  >();

  const waiterKey = (clientId: string, mutationId: number) => `${mutationId} ${clientId}`;

  /**
   * Runs one command on the device's rows and queues it, inside the caller's transaction. The
   * declared spaces must be valid ids the device knows, the mutator must succeed, and the
   * account's role must allow each table it wrote in each space it wrote.
   */
  const queue = Effect.fnUntraced(function* <E>(
    mutator: Sync.AnyMutator,
    version: number,
    args: Schema.Json,
    invocation: {
      readonly spaces: ReadonlyArray<string>;
      readonly run: Effect.Effect<void, E | Tx.Error, Tx.Service>;
    },
  ) {
    if (!invocation.spaces.every(isId)) {
      return yield* new Refusal.InvalidArgs({ mutator: mutator.name, version });
    }

    const spaces = yield* knownSpaces(invocation.spaces);

    for (const space of invocation.spaces) {
      if (!spaces.has(space)) return yield* new Refusal.NotMember({ space });
    }

    const { tx, written } = yield* SqliteTx.tracked({ actor, writes: mutator.writes });
    yield* Effect.provideService(invocation.run, Tx.Service, tx);
    const rows = written();

    for (const row of rows) {
      const space = spaces.get(row.space);

      if (space === undefined) {
        return yield* Effect.die(`${mutator.name} wrote ${row.space}, which it doesn't declare`);
      }

      const roles = definition.byName.tables.get(row.table)?.writableBy[space.kind] ?? [];

      if (!roles.includes(space.role)) return yield* new Refusal.NotAllowed({ space: row.space });
    }

    const { clientId, mutationId } = yield* Outbox.append({
      name: mutator.name,
      version,
      args,
      at: yield* Clock.currentTimeMillis,
      mode: mutator.mode,
    });

    const deferred = yield* Deferred.make<void, Rejected>();
    waiters.set(waiterKey(clientId, mutationId), { mutationId, deferred });

    return {
      mutation: { mutationId, confirmed: Deferred.await(deferred) } satisfies Mutation,
      tables: [...new Set(rows.map((row) => row.table)), keys.outbox],
    };
  });

  /**
   * Runs `effect` in one transaction, then invalidates the tables it changed and reports how many
   * commands wait, as counted in that transaction.
   */
  const commit = <A extends { readonly tables: Iterable<string> }, E>(
    effect: Effect.Effect<A, E, SqlClient.SqlClient>,
  ) =>
    sql
      .withTransaction(
        Effect.provideService(
          Effect.flatMap(effect, (result) =>
            Effect.map(Outbox.waiting, (waiting) => ({ result, waiting })),
          ),
          SqlClient.SqlClient,
          sql,
        ),
      )
      .pipe(
        Effect.tap(({ result }) => reactivity.invalidate([...new Set(result.tables)])),
        Effect.tap(({ waiting }) =>
          SubscriptionRef.update(status, (current) => ({ ...current, waiting })),
        ),
        Effect.map(({ result }) => result),
      );

  /** Completes the `confirmed` handles of the commands a pull settled. */
  const settled = Effect.fn("SyncClient.settled")(function* (settled: Outbox.Settled) {
    const take = (mutationId: number) => {
      const key = waiterKey(settled.clientId, mutationId);
      const waiter = waiters.get(key);
      waiters.delete(key);

      return waiter;
    };

    for (const mutationId of settled.applied) {
      const waiter = take(mutationId);

      if (waiter !== undefined) yield* Deferred.succeed(waiter.deferred, undefined);
    }

    for (const { mutationId, reason } of settled.refused) {
      const waiter = take(mutationId);

      if (waiter !== undefined) {
        yield* Deferred.fail(waiter.deferred, new Rejected({ mutationId, reason }));
      }
    }
  });

  /** Moves the handles of a renumbered outbox to the commands' new ids. */
  const renumbered = (renumbered: Replication.Renumbered) =>
    Effect.sync(() => {
      for (const [from, to] of renumbered.ids) {
        const waiter = waiters.get(waiterKey(renumbered.from, from));

        if (waiter === undefined) continue;
        waiters.delete(waiterKey(renumbered.from, from));
        waiters.set(waiterKey(renumbered.to, to), { mutationId: to, deferred: waiter.deferred });
      }
    });

  /**
   * Another device removed this one: its keys, data and outbox go, and the device starts over
   * under a new client id, so the account can sign in on it again. While a secret stays behind,
   * the old client id stays too, and the next pull wipes again.
   */
  const wipe = Effect.gen(function* () {
    const removed = yield* Effect.forEach(Ports.SecretName.literals, (name) =>
      secrets.remove(name).pipe(
        Effect.as(true),
        Effect.catchTags({
          "DeviceSecrets.SecretsUnavailable": () =>
            Effect.as(
              Effect.logWarning("A secret stayed on the device after the wipe", { secret: name }),
              false,
            ),
        }),
      ),
    );

    const clientId = yield* Effect.provideService(Ids.random, CryptoSuite.Service, suite);

    yield* commit(
      Effect.gen(function* () {
        yield* Rebase.clear;
        yield* Outbox.clear;

        if (removed.every(Boolean)) yield* Outbox.reset(clientId);

        return {
          tables: [...definition.tables.map((table) => table.name), ...Object.values(keys)],
        };
      }),
    );

    const reason = yield* Effect.orDie(encodeRevoked(new Protocol.DeviceRevoked()));

    for (const { mutationId, deferred } of waiters.values()) {
      yield* Deferred.fail(deferred, new Rejected({ mutationId, reason }));
    }

    waiters.clear();
    yield* SubscriptionRef.update(status, (current) => ({ ...current, revoked: true }));
  });

  const replication = Replication.make({
    definition,
    actor,
    report: (change) => SubscriptionRef.update(status, (current) => ({ ...current, ...change })),
    commit,
    settled,
    renumbered,
    wipe,
  });

  // A crash between two pages of a pull left the overlay on older rows.
  yield* replication.replayIfDue;

  const rounds = yield* Semaphore.make(1);

  const replicate: Interface["replicate"] = (remote) =>
    rounds.withPermit(
      replication
        .round(remote)
        .pipe(
          Effect.provideService(SqlClient.SqlClient, sql),
          Effect.provideService(CryptoSuite.Service, suite),
        ),
    );

  const mutate = Effect.fn("SyncClient.mutate")(function* <
    Args,
    E extends { readonly _tag: string },
    Writes extends ReadonlyArray<Sync.Any>,
  >(mutator: Sync.Mutator<string, Args, E, Writes>, args: Args) {
    if (definition.byName.mutators[mutator.mode].get(mutator.name) !== mutator) {
      return yield* Effect.die(`${mutator.name} isn't a mutator of the engine's definition`);
    }

    const invalid = () =>
      new Refusal.InvalidArgs({ mutator: mutator.name, version: mutator.version });

    const encoded = yield* Effect.mapError(Schema.encodeEffect(mutator.args)(args), invalid);
    // Replays and the server run the command on its stored arguments, so this first run does too.
    const decoded = yield* Effect.mapError(Schema.decodeEffect(mutator.args)(encoded), invalid);

    const { mutation } = yield* commit(
      queue(mutator, mutator.version, encoded, {
        spaces: mutator.spaces(decoded),
        run: mutator.run(decoded),
      }),
    );

    yield* PubSub.publish(writes, undefined);

    return mutation;
  });

  const redo: Interface["redo"] = (rejected) =>
    commit(
      Effect.gen(function* () {
        const taken = yield* Outbox.take(rejected.clientId, rejected.mutationId);

        if (Option.isNone(taken)) return { mutation: Option.none<Mutation>(), tables: [] };
        const { name, version, args } = taken.value;
        const mutator = definition.mutators.find((each) => each.name === name);

        if (mutator === undefined) return yield* new Refusal.UnknownMutator({ mutator: name });

        const invocation = yield* Effect.mapError(
          Sync.invoke(mutator, version, args),
          () => new Refusal.InvalidArgs({ mutator: name, version }),
        );

        const queued = yield* queue(mutator, version, args, invocation);

        return {
          mutation: Option.some(queued.mutation),
          tables: [...queued.tables, keys.refusals],
        };
      }),
    ).pipe(
      Effect.map(({ mutation }) => mutation),
      Effect.tap((mutation) =>
        Option.isSome(mutation) ? PubSub.publish(writes, undefined) : Effect.void,
      ),
    );

  const dismiss: Interface["dismiss"] = (rejected) =>
    Outbox.take(rejected.clientId, rejected.mutationId).pipe(
      Effect.andThen(reactivity.invalidate([keys.refusals])),
      Effect.provideService(SqlClient.SqlClient, sql),
    );

  yield* Supervisor.run({
    connect: Effect.flatMap(transport.connect, (connected) =>
      Supervisor.overRpc(connected, definition.contract),
    ),
    replicate,
    session,
    lifecycle,
    writes: Stream.fromPubSub(writes),
    offline,
    report: (connection) =>
      SubscriptionRef.update(status, (current) => ({ ...current, connection })),
    outdated: SubscriptionRef.update(status, (current) =>
      Option.isSome(current.updateRequired)
        ? current
        : { ...current, updateRequired: Option.some({ minimum: Option.none() }) },
    ),
  }).pipe(Effect.forkScoped);

  return Service.of({
    mutate,
    redo,
    dismiss,
    replicate,
    setOffline: (latched) => SubscriptionRef.set(offline, latched),
    status: { get: SubscriptionRef.get(status), changes: SubscriptionRef.changes(status) },
  });
});

/**
 * The engine for one device database, which dies at start on a definition `Sync.validate`
 * refuses. It keeps nothing outside its scope and the database, so closing the scope at any point
 * is a crash, and a new layer on the same database resumes from there.
 */
export const layer = (definition: Sync.Definition) => Layer.effect(Service, make(definition));
