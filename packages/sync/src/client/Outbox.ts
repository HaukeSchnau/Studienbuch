/**
 * The device's commands, in its own tables: the counters in `sync_meta`, the commands the server
 * hasn't settled in `sync_outbox`, the applied ones of the last 7 days in `sync_settled_command`
 * and the refused ones in `sync_rejected_command`. Every function runs inside the caller's
 * transaction.
 */
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type { Sync } from "../definition/Sync.ts";
import { Command as Wire } from "../protocol/Command.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";

export * as Outbox from "./Outbox.ts";

/**
 * One row an encrypted command's last run left: its JSON (`null` for a delete) and the base it
 * was computed from, which the server compares before it stores the sealed row.
 */
export const Draft = Schema.Struct({
  space: Schema.String,
  table: Schema.String,
  id: Schema.String,
  data: Schema.NullOr(Schema.String),
  base: Wire.Base,
});

export type Draft = typeof Draft.Type;

const Drafts = Schema.fromJsonString(Schema.Array(Draft));
const encodeDrafts = Schema.encodeEffect(Drafts);
const Sealed = Schema.fromJsonString(Schema.toCodecJson(Wire.Seal));
const encodeSealed = Schema.encodeEffect(Sealed);
const encodeReason = Schema.encodeEffect(Schema.fromJsonString(Refusal.Reason));

/** A command as the device stores it: its invocation in plaintext. */
export interface Command {
  readonly mutationId: number;
  readonly name: string;
  readonly version: number;
  readonly args: Schema.Json;
  /** When the user acted, in epoch milliseconds by the device's clock. */
  readonly at: number;
  readonly mode: Sync.Mode;
  /** A `Seal` command's rows from its last run, `null` for `Mutate` and before a run. */
  readonly writes: ReadonlyArray<Draft> | null;
  /** The refusal of a `Seal` command's last run, which the device shows once the id settles. */
  readonly failure: Refusal.Reason | null;
  /** A `Seal` command as the push first sent it, which a resend repeats byte for byte. */
  readonly sealed: Wire.Seal | null;
}

export interface Meta {
  readonly clientId: string;
  /** The restore epoch of the last pull, `null` before the first. */
  readonly syncEpoch: string | null;
  /** The mutation id of the newest command. */
  readonly lastMutationId: number;
  /** Every command up to here has left the outbox. */
  readonly settledMutationId: number;
  /** A page changed base rows since the overlay was last replayed. */
  readonly replayDue: boolean;
}

/** A command the server refused, kept until the user dismisses or redoes it. */
export interface Rejected extends Omit<Command, "mode" | "writes" | "failure" | "sealed"> {
  readonly clientId: string;
  readonly reason: Refusal.Reason;
}

const MetaRow = Schema.Struct({
  client_id: Schema.String,
  sync_epoch: Schema.NullOr(Schema.String),
  last_mutation_id: Schema.Int,
  settled_mutation_id: Schema.Int,
  replay_due: Schema.Int,
});

const commandFields = {
  mutation_id: Schema.Int,
  name: Schema.String,
  version: Schema.Int,
  args: Schema.fromJsonString(Schema.Json),
  at: Schema.Int,
};

const CommandRow = Schema.Struct({
  ...commandFields,
  mode: Schema.Literals(["Mutate", "Seal"]),
  writes: Schema.NullOr(Drafts),
  failure: Schema.NullOr(Schema.fromJsonString(Refusal.Reason)),
  sealed: Schema.NullOr(Sealed),
});

const RejectedRow = Schema.Struct({
  ...commandFields,
  client_id: Schema.String,
  reason: Schema.fromJsonString(Refusal.Reason),
});

// The engine wrote these rows itself, so a row that doesn't decode is a defect, not a refusal.
const decodeRows = <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S) => {
  const decode = Schema.decodeUnknownEffect(Schema.Array(schema));

  return (rows: ReadonlyArray<object>) => Effect.orDie(decode(rows));
};

const decodeMeta = decodeRows(MetaRow);
const decodeCommands = decodeRows(CommandRow);
const decodeRejected = decodeRows(RejectedRow);

const command = (row: typeof CommandRow.Type): Command => ({
  mutationId: row.mutation_id,
  name: row.name,
  version: row.version,
  args: row.args,
  at: row.at,
  mode: row.mode,
  writes: row.writes,
  failure: row.failure,
  sealed: row.sealed,
});

/** A readable command as the push sends it. */
export const asMutate = (
  command: Pick<Command, "mutationId" | "name" | "version" | "args" | "at">,
) =>
  Wire.Mutate.make({
    mutationId: command.mutationId,
    name: command.name,
    version: command.version,
    args: command.args,
    at: DateTime.makeUnsafe(command.at),
  });

/** Creates the device's state on its first start. A later start keeps what is there. */
export const start = Effect.fnUntraced(function* (clientId: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into sync_meta (id, client_id, sync_epoch, last_mutation_id, settled_mutation_id)
    values (1, ${clientId}, null, 0, 0)
    on conflict (id) do nothing
  `;
});

export const meta = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* decodeMeta(
    yield* sql`
      select client_id, sync_epoch, last_mutation_id, settled_mutation_id, replay_due
      from sync_meta where id = 1
    `,
  );

  const row = rows[0];

  if (row === undefined) return yield* Effect.die("The device's meta row is missing");

  return {
    clientId: row.client_id,
    syncEpoch: row.sync_epoch,
    lastMutationId: row.last_mutation_id,
    settledMutationId: row.settled_mutation_id,
    replayDue: row.replay_due === 1,
  } satisfies Meta;
});

const insert = Effect.fnUntraced(function* (command: Command) {
  const sql = yield* SqlClient.SqlClient;
  const args = yield* Effect.fromResult(CanonicalJson.encode(command.args));
  const writes = command.writes === null ? null : yield* Effect.orDie(encodeDrafts(command.writes));

  const failure =
    command.failure === null ? null : yield* Effect.orDie(encodeReason(command.failure));

  const sealed = command.sealed === null ? null : yield* Effect.orDie(encodeSealed(command.sealed));

  yield* sql`
    insert into sync_outbox (mutation_id, name, version, args, at, mode, writes, failure, sealed)
    values (${command.mutationId}, ${command.name}, ${command.version}, ${args}, ${command.at},
      ${command.mode}, ${writes}, ${failure}, ${sealed})
  `;
});

/** Queues a command under the next mutation id, and returns that id with the client's. */
export const append = Effect.fnUntraced(function* (entry: Omit<Command, "mutationId">) {
  const sql = yield* SqlClient.SqlClient;

  const [next] = yield* sql<{ readonly client_id: string; readonly last_mutation_id: number }>`
    update sync_meta set last_mutation_id = last_mutation_id + 1 where id = 1
    returning client_id, last_mutation_id
  `;

  if (next === undefined) return yield* Effect.die("The device's meta row is missing");
  yield* insert({ ...entry, mutationId: next.last_mutation_id });

  return { clientId: next.client_id, mutationId: next.last_mutation_id };
});

/** The commands waiting for the server, oldest first. */
export const pending = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* decodeCommands(
    yield* sql`
      select mutation_id, name, version, args, at, mode, writes, failure, sealed from sync_outbox
      order by mutation_id
    `,
  );

  return rows.map(command);
});

/** At most `limit` waiting commands after `mutationId`, oldest first: the next push. */
export const after = Effect.fnUntraced(function* (mutationId: number, limit: number) {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* decodeCommands(
    yield* sql`
      select mutation_id, name, version, args, at, mode, writes, failure, sealed from sync_outbox
      where mutation_id > ${mutationId} order by mutation_id limit ${limit}
    `,
  );

  return rows.map(command);
});

export const waiting = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ readonly count: number }>`select count(*) as count from sync_outbox`;

  return row?.count ?? 0;
});

export const rejected = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* decodeRejected(
    yield* sql`
      select client_id, mutation_id, name, version, args, at, reason from sync_rejected_command
      order by at, client_id, mutation_id
    `,
  );

  return rows.map((row): Rejected => ({
    clientId: row.client_id,
    mutationId: row.mutation_id,
    name: row.name,
    version: row.version,
    args: row.args,
    at: row.at,
    reason: row.reason,
  }));
});

const TakenRow = Schema.Struct({
  name: Schema.String,
  version: Schema.Int,
  args: Schema.fromJsonString(Schema.Json),
});

const decodeTaken = decodeRows(TakenRow);

/** Deletes a refusal and returns its command, or `None` when it is gone already. */
export const take = Effect.fnUntraced(function* (clientId: string, mutationId: number) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* decodeTaken(
    yield* sql`
      delete from sync_rejected_command where client_id = ${clientId} and mutation_id = ${mutationId}
      returning name, version, args
    `,
  );

  return Option.fromNullishOr(row);
});

/** Keeps a `Seal` command's rows from its latest run, or the refusal that run ended with. */
export const materialize = Effect.fnUntraced(function* (
  mutationId: number,
  writes: ReadonlyArray<Draft>,
  failure: Refusal.Reason | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const text = yield* Effect.orDie(encodeDrafts(writes));
  const reason = failure === null ? null : yield* Effect.orDie(encodeReason(failure));

  yield* sql`
    update sync_outbox set writes = ${text}, failure = ${reason} where mutation_id = ${mutationId}
  `;
});

/**
 * Keeps a `Seal` as the push is about to send it. Every resend repeats it, because the server
 * answers a different command under a used id `ClientUnknown`.
 */
export const keepSealed = Effect.fnUntraced(function* (seal: Wire.Seal) {
  const sql = yield* SqlClient.SqlClient;
  const text = yield* Effect.orDie(encodeSealed(seal));

  yield* sql`update sync_outbox set sealed = ${text} where mutation_id = ${seal.mutationId}`;
});

/**
 * Forgets what the push sent for commands the server answered `Stale`. The next pull replays them
 * on the newer rows, and the push seals them again.
 */
export const forgetSealed = Effect.fnUntraced(function* (mutationIds: ReadonlyArray<number>) {
  const sql = yield* SqlClient.SqlClient;

  if (mutationIds.length === 0) return;
  yield* sql`update sync_outbox set sealed = null where ${sql.in("mutation_id", mutationIds)}`;
  yield* setReplayDue(true);
});

/** The newest waiting command whose rows include `id` in `space`. */
export const lastWriter = Effect.fnUntraced(function* (space: string, id: string) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{ readonly mutation_id: number | null }>`
    select max(outbox.mutation_id) as mutation_id from sync_outbox as outbox, json_each(outbox.writes)
    where json_each.value ->> '$.space' = ${space} and json_each.value ->> '$.id' = ${id}
  `;

  return Option.fromNullishOr(row?.mutation_id);
});

const decodeSettling = decodeRows(
  Schema.Struct({
    mutation_id: Schema.Int,
    failure: Schema.NullOr(Schema.fromJsonString(Refusal.Reason)),
  }),
);

/** How long the device keeps an applied command, for a restore of the server's database. */
export const keepSettledFor = 7 * 24 * 60 * 60 * 1000;

export interface Refused {
  readonly mutationId: number;
  readonly reason: Refusal.Reason;
}

/** The commands of `clientId` that settling took out of the outbox. */
export interface Settled {
  readonly clientId: string;
  readonly applied: ReadonlyArray<number>;
  readonly refused: ReadonlyArray<Refused>;
}

/**
 * Takes every command up to `lastMutationId` out of the outbox: the refused ones into
 * `sync_rejected_command` with their reasons, the others into `sync_settled_command`, and forgets
 * settled commands older than {@link keepSettledFor}.
 */
export const settle = Effect.fnUntraced(function* (
  lastMutationId: number,
  refusals: ReadonlyArray<Refused>,
  now: number,
) {
  const sql = yield* SqlClient.SqlClient;
  const { clientId, settledMutationId } = yield* meta;

  if (lastMutationId <= settledMutationId) {
    return { clientId, applied: [], refused: [] } satisfies Settled;
  }

  const ids = yield* decodeSettling(
    yield* sql`
      select mutation_id, failure from sync_outbox where mutation_id <= ${lastMutationId}
      order by mutation_id
    `,
  );

  // A sealed command whose replay refused went out without rows. The server applied it, so the
  // device's own reason is the verdict.
  const reasons = new Map([
    ...ids.flatMap(({ mutation_id, failure }) =>
      failure === null ? [] : [[mutation_id, failure] as const],
    ),
    ...refusals.map((refusal) => [refusal.mutationId, refusal.reason] as const),
  ]);

  const refused = ids.flatMap(({ mutation_id }): Array<Refused> => {
    const reason = reasons.get(mutation_id);

    return reason === undefined ? [] : [{ mutationId: mutation_id, reason }];
  });

  for (const { mutationId, reason } of refused) {
    const text = yield* Effect.orDie(Effect.fromResult(CanonicalJson.encode(reason)));

    yield* sql`
      insert into sync_rejected_command (client_id, mutation_id, name, version, args, at, reason)
      select ${clientId}, mutation_id, name, version, args, at, ${text} from sync_outbox
      where mutation_id = ${mutationId}
    `;
    yield* sql`delete from sync_outbox where mutation_id = ${mutationId}`;
  }

  yield* sql`
    insert into sync_settled_command (mutation_id, name, version, args, at, mode, settled_at)
    select mutation_id, name, version, args, at, mode, ${now} from sync_outbox
    where mutation_id <= ${lastMutationId}
  `;
  yield* sql`delete from sync_outbox where mutation_id <= ${lastMutationId}`;
  yield* sql`delete from sync_settled_command where settled_at < ${now - keepSettledFor}`;
  yield* sql`update sync_meta set settled_mutation_id = ${lastMutationId} where id = 1`;

  return {
    clientId,
    applied: ids
      .map(({ mutation_id }) => mutation_id)
      .filter((mutationId) => !reasons.has(mutationId)),
    refused,
  } satisfies Settled;
});

/**
 * After a restore of the server's database, the settled commands it lost go back into the outbox.
 * Returns whether the device then holds every command after `lastMutationId` up to its last. A
 * hole, as a refused command leaves, means the outbox needs a new client id before any push.
 */
export const restore = Effect.fnUntraced(function* (lastMutationId: number, syncEpoch: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    insert into sync_outbox (mutation_id, name, version, args, at, mode)
    select mutation_id, name, version, args, at, mode from sync_settled_command
    where mutation_id > ${lastMutationId}
  `;
  yield* sql`delete from sync_settled_command where mutation_id > ${lastMutationId}`;
  yield* sql`
    update sync_meta set sync_epoch = ${syncEpoch},
      settled_mutation_id = min(settled_mutation_id, ${lastMutationId})
    where id = 1
  `;

  const [run] = yield* sql<{
    readonly low: number | null;
    readonly held: number;
    readonly last: number;
  }>`
    select (select min(mutation_id) from sync_outbox where mutation_id > ${lastMutationId}) as low,
      (select count(*) from sync_outbox where mutation_id > ${lastMutationId}) as held,
      last_mutation_id as last
    from sync_meta where id = 1
  `;

  if (run === undefined) return yield* Effect.die("The device's meta row is missing");

  return (
    run.last >= lastMutationId &&
    run.held === run.last - lastMutationId &&
    (run.held === 0 || run.low === lastMutationId + 1)
  );
});

/**
 * Gives the outbox to a new client id, numbered from 1 in the same order, and forgets the settled
 * commands of the old one. Returns each waiting command's new mutation id by its old one.
 */
export const renumber = Effect.fnUntraced(function* (clientId: string) {
  const sql = yield* SqlClient.SqlClient;
  const commands = yield* pending;

  yield* sql`delete from sync_outbox`;
  yield* sql`delete from sync_settled_command`;

  for (const [index, each] of commands.entries()) {
    // The arguments were stored canonical, so they encode again. A sealed command seals again
    // under its new id, which the server hasn't seen.
    yield* insert({ ...each, mutationId: index + 1, sealed: null }).pipe(
      Effect.catchTags({ "CanonicalJson.Unrepresentable": Effect.die }),
    );
  }

  yield* sql`
    update sync_meta set client_id = ${clientId}, last_mutation_id = ${commands.length},
      settled_mutation_id = 0
    where id = 1
  `;

  return new Map(commands.map((each, index) => [each.mutationId, index + 1]));
});

export const setReplayDue = Effect.fnUntraced(function* (due: boolean) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`update sync_meta set replay_due = ${due ? 1 : 0} where id = 1`;
});

export const setSyncEpoch = Effect.fnUntraced(function* (syncEpoch: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`update sync_meta set sync_epoch = ${syncEpoch} where id = 1`;
});

/** Forgets every command, for a device another device removed. */
export const clear = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`delete from sync_outbox`;
  yield* sql`delete from sync_settled_command`;
  yield* sql`delete from sync_rejected_command`;
});

/** Starts the device over under a new client id, as on its first start. */
export const reset = Effect.fnUntraced(function* (clientId: string) {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    update sync_meta set client_id = ${clientId}, sync_epoch = null, last_mutation_id = 0,
      settled_mutation_id = 0
    where id = 1
  `;
});
