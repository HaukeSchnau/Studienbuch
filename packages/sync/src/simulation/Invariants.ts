/**
 * What must hold in every simulated world. Each check returns the violations it found, empty when
 * the invariant holds, so a run collects all of them for its report instead of stopping at one.
 */
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Outbox } from "../client/Outbox.ts";
import { SqliteTx } from "../client/SqliteTx.ts";
import { Sync } from "../definition/Sync.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";
import { Leaks } from "./Leaks.ts";

export * as Invariants from "./Invariants.ts";

export type Name = "replay" | "gapless" | "plaintext" | "convergence" | "nothing-lost" | "liveness";

export interface Violation {
  readonly invariant: Name;
  /** Where, such as `device a` or `postgres sync_row`. */
  readonly place: string;
  readonly detail: string;
}

const Row = Schema.Struct({
  space: Schema.String,
  tbl: Schema.String,
  id: Schema.String,
  data: Schema.String,
});

type Row = typeof Row.Type;

const decodeRows = Schema.decodeUnknownEffect(Schema.Array(Row));

const views = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  return yield* decodeRows(
    yield* sql`select space, tbl, id, data from sync_row_view order by space, tbl, id`,
  );
}).pipe(Effect.orDie);

/** Carries the replayed rows out of the transaction that computed them, which then rolls back. */
class Replayed extends Schema.TaggedError<Replayed, { readonly brand: unique symbol }>()(
  "Invariants.Replayed",
  { shown: Schema.Array(Row), rows: Schema.Array(Row) },
) {}

/**
 * The device's rows as its base rows and its outbox give them: the overlay emptied, then every
 * waiting command run again in order, each in a savepoint so a command that fails now leaves
 * nothing, as the engine's rebase does (m1-plan, choice 5).
 */
const replayed = Effect.fn("Invariants.replayed")(function* (
  definition: Sync.Definition,
  actor: string,
) {
  const sql = yield* SqlClient.SqlClient;

  const rerun = Effect.fn("Invariants.rerun")(function* (command: Outbox.Command) {
    const mutator = definition.byName.mutators[command.mode].get(command.name);

    if (mutator === undefined) return;
    const invocation = yield* Sync.invoke(mutator, command.version, command.args);
    const tx = yield* SqliteTx.make({ actor, writes: mutator.writes });

    yield* Effect.provideService(invocation.run, Tx.Service, tx);
  });

  // One transaction, so the engine running beside the check commits nothing between the reads.
  const replay = Effect.gen(function* () {
    const shown = yield* views;
    const commands = yield* Outbox.pending;

    yield* sql`delete from pending_row`;

    for (const command of commands) {
      yield* sql.withTransaction(rerun(command)).pipe(Effect.ignore);
    }

    return yield* new Replayed({ shown, rows: yield* views });
  });

  return yield* sql.withTransaction(replay).pipe(
    Effect.catchTags({
      "Invariants.Replayed": ({ shown, rows }) => Effect.succeed({ shown, expected: rows }),
    }),
  );
}, Effect.orDie);

const key = (row: Row) => `${row.space} ${row.tbl} ${row.id}`;

const differences = (shown: ReadonlyArray<Row>, expected: ReadonlyArray<Row>) => {
  const want = new Map(expected.map((row) => [key(row), row.data]));
  const have = new Map(shown.map((row) => [key(row), row.data]));

  return [...new Set([...want.keys(), ...have.keys()])].flatMap((row) =>
    want.get(row) === have.get(row)
      ? []
      : [`${row}: shows ${have.get(row) ?? "nothing"}, expected ${want.get(row) ?? "nothing"}`],
  );
};

/** At all times a device's views equal its base rows with its outbox replayed on top. */
export const replay = Effect.fn("Invariants.replay")(function* (
  place: string,
  definition: Sync.Definition,
  actor: string,
) {
  const { shown, expected } = yield* replayed(definition, actor);

  return differences(shown, expected).map((detail): Violation => ({
    invariant: "replay",
    place,
    detail,
  }));
});

/** A device numbers its commands from 1 without gaps, and the outbox holds the unsettled ones. */
export const gapless = Effect.fn("Invariants.gapless")(function* (place: string) {
  // One transaction, so a pull that settles commands can't commit between the two reads.
  const { meta, pending } = yield* Effect.flatMap(SqlClient.SqlClient, (sql) =>
    sql.withTransaction(Effect.all({ meta: Outbox.meta, pending: Outbox.pending })),
  );

  const waiting = pending.map((command) => command.mutationId).join(",");

  const expected = Array.from(
    { length: meta.lastMutationId - meta.settledMutationId },
    (_, index) => meta.settledMutationId + index + 1,
  ).join(",");

  const violation: Violation = {
    invariant: "gapless",
    place,
    detail: `outbox ${waiting}, expected ${expected}`,
  };

  return waiting === expected ? [] : [violation];
}, Effect.orDie);

/** No marker of an encrypted field anywhere in the server's Postgres. */
export const plaintextInPostgres = Effect.map(Leaks.postgres, (leaks) =>
  leaks.map((leak): Violation => ({
    invariant: "plaintext",
    place: leak.place,
    detail: leak.excerpt,
  })),
).pipe(Effect.orDie);

/**
 * No marker in text the server saw: a frame it received, a line it logged, a span it ended. A
 * frame may carry a forged command's markers, so `among` is the honest ones' forms for frames.
 */
export const plaintextIn = (
  place: string,
  text: string,
  among: ReadonlyArray<string> = Leaks.stored,
): ReadonlyArray<Violation> =>
  Leaks.find(place, text, among).map((leak) => ({
    invariant: "plaintext",
    place: leak.place,
    detail: leak.excerpt,
  }));

// At quiescence: every device online, healed and synced until nothing moves.

const BaseRow = Schema.Struct({
  space: Schema.String,
  tbl: Schema.String,
  id: Schema.String,
  version: Schema.Finite,
  data: Schema.String,
});

type BaseRow = typeof BaseRow.Type;

const decodeBaseRows = Schema.decodeUnknownEffect(Schema.Array(BaseRow));

const rowKey = (row: BaseRow) => `${row.space} ${row.tbl} ${row.id}`;

/** A row's version and data, its data in canonical JSON, as Postgres writes `jsonb` with spaces. */
const rowValue = (row: BaseRow) =>
  `v${row.version} ${Result.getOrElse(CanonicalJson.normalize(row.data), () => row.data)}`;

/** A device's readable base rows, as the server sent them. */
export const deviceRows = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  return yield* decodeBaseRows(
    yield* sql`
      select space, tbl, id, version, data from base_row where tbl <> ''
      order by space, tbl, id
    `,
  );
}).pipe(Effect.orDie);

/** The server's live readable rows in the spaces `account` reads, as a pull would send them. */
export const serverRows = Effect.fn("Invariants.serverRows")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  return yield* decodeBaseRows(
    yield* sql`
        select r.space_id as space, r.tbl, r.id, r.version::float8 as version,
          r.data::text as data
        from sync_row r join space_member m on m.space_id = r.space_id
        where m.account_id = ${account} and r.tbl <> '' and r.data is not null
        order by r.space_id, r.tbl, r.id
      `,
  );
}, Effect.orDie);

/** Every device holds exactly the server's readable rows of the spaces its account reads. */
export const converged = (
  place: string,
  shown: ReadonlyArray<BaseRow>,
  expected: ReadonlyArray<BaseRow>,
): ReadonlyArray<Violation> => {
  const want = new Map(expected.map((row) => [rowKey(row), rowValue(row)]));
  const have = new Map(shown.map((row) => [rowKey(row), rowValue(row)]));

  return [...new Set([...want.keys(), ...have.keys()])].flatMap((row) =>
    want.get(row) === have.get(row)
      ? []
      : [
          {
            invariant: "convergence",
            place,
            detail: `${row}: has ${have.get(row) ?? "nothing"}, server ${want.get(row) ?? "nothing"}`,
          } satisfies Violation,
        ],
  );
};

const decodeReason = Schema.decodeUnknownEffect(Schema.fromJsonString(Refusal.Reason));

/**
 * A refusal's reason in canonical JSON, tag and fields, which the device and the server must agree
 * on. Postgres writes `jsonb` with spaces, the device without.
 */
const reasonOf = (text: string) =>
  Effect.flatMap(decodeReason(text), (reason) => Effect.fromResult(CanonicalJson.encode(reason)));

/** A device's state at quiescence: its counters, its waiting commands and its refusals' reasons. */
export const settledState = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const meta = yield* Outbox.meta;
  const waiting = yield* Outbox.pending;

  const rows = yield* sql<{ readonly mutation_id: number; readonly reason: string }>`
    select mutation_id, reason from sync_rejected_command where client_id = ${meta.clientId}
    order by mutation_id
  `;

  const refused = yield* Effect.forEach(rows, (row) =>
    Effect.map(reasonOf(row.reason), (reason) => `${row.mutation_id} ${reason}`),
  );

  return { meta, waiting, refused };
}).pipe(
  // One transaction, so the engine's periodic pull can't commit between the reads.
  (state) => Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(state)),
  Effect.orDie,
);

export interface Processed {
  readonly mutationId: number;
  /** The refusal's reason in canonical JSON, or `undefined` for an applied command. */
  readonly refused: string | undefined;
}

/** The server's record of one client: each command it processed, and each refusal's reason. */
export const serverLog = Effect.fn("Invariants.serverLog")(function* (clientId: string) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ readonly mutation_id: number; readonly reason: string | null }>`
      select mutation_id::float8 as mutation_id, reason::text as reason from command_log
      where client_id = ${clientId} order by mutation_id
    `;

  return yield* Effect.forEach(rows, (row) =>
    row.reason === null
      ? Effect.succeed<Processed>({ mutationId: row.mutation_id, refused: undefined })
      : Effect.map(reasonOf(row.reason), (reason): Processed => ({
          mutationId: row.mutation_id,
          refused: reason,
        })),
  );
}, Effect.orDie);

/**
 * Nothing is lost: the outbox is empty, the server processed every command of the device's client
 * exactly once and in order, and every refusal the server recorded waits on the device with the
 * same reason, unless the user dismissed it.
 */
export const nothingLost = (
  place: string,
  device: Effect.Success<typeof settledState>,
  log: ReadonlyArray<Processed>,
  dismissed: ReadonlySet<number>,
): ReadonlyArray<Violation> => {
  const found: Array<Violation> = [];

  const violation = (detail: string) => {
    found.push({ invariant: "nothing-lost", place, detail });
  };

  if (device.waiting.length > 0) {
    violation(`commands ${device.waiting.map((command) => command.mutationId).join(",")} wait`);
  }

  const processed = log.map((entry) => entry.mutationId).join(",");
  const count = device.meta.lastMutationId;
  const expected = Array.from({ length: count }, (_, index) => index + 1).join(",");

  if (processed !== expected) violation(`server processed ${processed}, expected ${expected}`);

  const refusedOnServer = log
    .flatMap((entry) =>
      entry.refused === undefined || dismissed.has(entry.mutationId)
        ? []
        : [`${entry.mutationId} ${entry.refused}`],
    )
    .join(", ");

  const refusedOnDevice = device.refused.join(", ");

  if (refusedOnServer !== refusedOnDevice) {
    violation(`server refused ${refusedOnServer}, device shows ${refusedOnDevice}`);
  }

  return found;
};
