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

export type Name =
  | "replay"
  | "gapless"
  | "cursors"
  | "membership"
  | "plaintext"
  | "convergence"
  | "nothing-lost"
  | "liveness";

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

/** Whether a statement of this database waits for a lock on `sync_row`. */
export const waitingForRows = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly waiting: boolean }>`
    select exists (
      select 1 from pg_locks l join pg_class c on c.oid = l.relation
      where c.relname = 'sync_row' and not l.granted
        and l.database = (select oid from pg_database where datname = current_database())
    ) as waiting
  `;

  return row?.waiting === true;
}).pipe(Effect.orDie);

/** No marker of an encrypted field in any of `tables`, the server's Postgres. */
export const plaintextInPostgres = (tables: ReadonlyArray<Leaks.Table>) =>
  Effect.map(Leaks.scan(tables), (leaks) =>
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

/** A command as it reads in canonical JSON: its name, version and arguments. */
const contentOf = (name: string | null, version: number | null, args: Schema.Json) =>
  Effect.map(Effect.fromResult(CanonicalJson.encode(args)), (json) => `${name}@${version} ${json}`);

const decodeArgs = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Json));

/**
 * A device's state at quiescence: its counters, its waiting commands, its refusals' reasons and
 * what the commands it counts as applied said.
 */
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

  // Kept for a week, and only the current client id's: renumbering forgets the old one's.
  const settledRows = yield* sql<{
    readonly mutation_id: number;
    readonly name: string;
    readonly version: number;
    readonly args: string;
  }>`select mutation_id, name, version, args from sync_settled_command order by mutation_id`;

  const applied = yield* Effect.forEach(settledRows, (row) =>
    Effect.flatMap(decodeArgs(row.args), (args) =>
      Effect.map(contentOf(row.name, row.version, args), (content) => ({
        mutationId: row.mutation_id,
        content,
      })),
    ),
  );

  return { meta, waiting, refused, applied };
}).pipe(
  // One transaction, so a pull can't commit between the reads.
  (state) => Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(state)),
  Effect.orDie,
);

export interface Processed {
  readonly mutationId: number;
  /** The refusal's reason in canonical JSON, or `undefined` for an applied command. */
  readonly refused: string | undefined;
  /**
   * What the server read of the command, as `contentOf` writes it. A command whose arguments it
   * couldn't read logs only their hash, and then this names that.
   */
  readonly content: string;
}

/** The arguments the command log kept, when it could read them. */
const Detail = Schema.fromJsonString(Schema.Struct({ args: Schema.Json }));

const decodeDetail = Schema.decodeUnknownEffect(Detail);

/** The server's record of one client: each command it processed, what it said and any refusal. */
export const serverLog = Effect.fn("Invariants.serverLog")(function* (clientId: string) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{
    readonly mutation_id: number;
    readonly name: string | null;
    readonly version: number | null;
    readonly detail: string;
    readonly reason: string | null;
  }>`
      select mutation_id::float8 as mutation_id, name, version, detail::text as detail,
        reason::text as reason
      from command_log where client_id = ${clientId} order by mutation_id
    `;

  return yield* Effect.forEach(rows, (row) =>
    Effect.gen(function* () {
      const detail = yield* Effect.option(decodeDetail(row.detail));

      const content =
        detail._tag === "Some"
          ? yield* contentOf(row.name, row.version, detail.value.args)
          : `${row.name}@${row.version} unreadable ${row.detail}`;

      const refused = row.reason === null ? undefined : yield* reasonOf(row.reason);

      return { mutationId: row.mutation_id, refused, content } satisfies Processed;
    }),
  );
}, Effect.orDie);

/**
 * Nothing is lost: the outbox is empty, the server processed every command of the device's client
 * exactly once and in order, every command the device counts as applied is one the server applied
 * with the same name and arguments, and every refusal the server recorded waits on the device with
 * the same reason, unless the user dismissed it.
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

  const byId = new Map(log.map((entry) => [entry.mutationId, entry]));

  for (const { mutationId, content } of device.applied) {
    const logged = byId.get(mutationId);

    if (logged === undefined || logged.refused !== undefined || logged.content !== content) {
      violation(
        `#${mutationId} applied as ${content}, server ${logged === undefined ? "has nothing" : logged.refused === undefined ? `applied ${logged.content}` : `refused ${logged.content}`}`,
      );
    }
  }

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

/**
 * A device's cursor covers its rows: no base row is newer than its space's cursor. A pull reads
 * one snapshot, so each page's rows end at the version it reports.
 */
export const cursors = Effect.fn("Invariants.cursors")(function* (place: string) {
  const sql = yield* SqlClient.SqlClient;

  const ahead = yield* sql<{
    readonly space: string;
    readonly newest: number;
    readonly cursor: number | null;
  }>`
    select r.space, max(r.version) as newest, s.version as cursor
    from base_row r join sync_space s on s.id = r.space
    group by r.space, s.version
    having s.version is null or max(r.version) > s.version
    order by r.space
  `;

  return ahead.map((row): Violation => ({
    invariant: "cursors",
    place,
    detail: `${row.space}: a row at ${row.newest}, cursor ${row.cursor ?? "none"}`,
  }));
}, Effect.orDie);

const decodeCourses = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ courses: Schema.Array(Schema.String) })),
);

/**
 * An account reads exactly the course spaces its notebook's choice names under the notebook's
 * school, and none once it left the school. Read in one snapshot, as the grants commit with the
 * choice.
 */
export const courseMembership = Effect.fn("Invariants.courseMembership")(function* (
  account: string,
  notebook: string,
  choice: { readonly table: string; readonly id: string; readonly kind: string },
) {
  const sql = yield* SqlClient.SqlClient;

  const read = Effect.gen(function* () {
    yield* sql`set transaction isolation level repeatable read, read only`;

    const [chosen] = yield* sql<{ readonly data: string; readonly school: string }>`
      select r.data::text as data, n.parent_id as school
      from sync_row r join space n on n.id = r.space_id
      join space_member m on m.space_id = n.parent_id and m.account_id = ${account}
      where r.space_id = ${notebook} and r.tbl = ${choice.table} and r.id = ${choice.id}
        and r.data is not null
    `;

    const courses = chosen === undefined ? [] : (yield* decodeCourses(chosen.data)).courses;

    const expected =
      chosen === undefined || courses.length === 0
        ? []
        : yield* sql<{ readonly id: string }>`
            select id from space
            where parent_id = ${chosen.school} and kind = ${choice.kind}
              and key in ${sql.in(courses)}
            order by id
          `;

    const held = yield* sql<{ readonly id: string }>`
      select s.id from space_member m join space s on s.id = m.space_id
      where m.account_id = ${account} and s.kind = ${choice.kind}
      order by s.id
    `;

    return { expected: expected.map((row) => row.id), held: held.map((row) => row.id) };
  });

  const { expected, held } = yield* sql.withTransaction(read);

  return expected.join(",") === held.join(",")
    ? []
    : [
        {
          invariant: "membership",
          place: `account ${account}`,
          detail: `reads courses ${held.join(",") || "none"}, its choice names ${expected.join(",") || "none"}`,
        } satisfies Violation,
      ];
}, Effect.orDie);

/** The spaces a device knows, with its role in each. */
export const deviceSpaces = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ readonly id: string; readonly role: string }>`
    select id, role from sync_space order by id
  `;

  return rows.map((row) => `${row.id} ${row.role}`);
}).pipe(Effect.orDie);

/** The spaces the server says an account reads, with its role in each. */
export const serverSpaces = Effect.fn("Invariants.serverSpaces")(function* (account: string) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* sql<{ readonly id: string; readonly role: string }>`
    select space_id as id, role from space_member where account_id = ${account} order by space_id
  `;

  return rows.map((row) => `${row.id} ${row.role}`);
}, Effect.orDie);

/** A device at rest knows exactly the spaces its account reads. */
export const sameSpaces = (
  place: string,
  shown: ReadonlyArray<string>,
  expected: ReadonlyArray<string>,
): ReadonlyArray<Violation> =>
  shown.join(", ") === expected.join(", ")
    ? []
    : [
        {
          invariant: "convergence",
          place,
          detail: `knows spaces ${shown.join(", ") || "none"}, the server ${expected.join(", ") || "none"}`,
        },
      ];
