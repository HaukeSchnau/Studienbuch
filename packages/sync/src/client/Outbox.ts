/**
 * The device's commands, in its own tables: the counters in `sync_meta`, the commands the server
 * hasn't settled in `sync_outbox`, and the refused ones in `sync_rejected_command`. Every function
 * runs on the caller's connection, so inside the caller's transaction.
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type { Sync } from "../definition/Sync.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";

export * as Outbox from "./Outbox.ts";

/** A command as the device stores it: its invocation in plaintext. */
export interface Command {
  readonly mutationId: number;
  readonly name: string;
  readonly version: number;
  readonly args: Schema.Json;
  /** When the user acted, in epoch milliseconds by the device's clock. */
  readonly at: number;
  readonly mode: Sync.Mode;
}

export interface Meta {
  readonly clientId: string;
  /** The restore epoch of the last pull, `null` before the first. */
  readonly syncEpoch: string | null;
  /** The mutation id of the newest command. */
  readonly lastMutationId: number;
  /** Every command up to here has left the outbox. */
  readonly settledMutationId: number;
}

/** A command the server refused, kept until the user dismisses or redoes it. */
export interface Rejected extends Omit<Command, "mode"> {
  readonly clientId: string;
  readonly reason: Refusal.Reason;
}

const MetaRow = Schema.Struct({
  client_id: Schema.String,
  sync_epoch: Schema.NullOr(Schema.String),
  last_mutation_id: Schema.Int,
  settled_mutation_id: Schema.Int,
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
});

/** A new client id, a UUIDv4 from `Random`, so a seeded run names its devices the same way. */
export const newClientId = Effect.gen(function* () {
  const bytes: Array<number> = [];

  for (let index = 0; index < 16; index++) bytes.push(yield* Random.nextIntBetween(0, 255));

  // RFC 9562: version 4 in the high nibble of byte 6, variant 0b10 in the high bits of byte 8.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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
      select client_id, sync_epoch, last_mutation_id, settled_mutation_id from sync_meta where id = 1
    `,
  );

  const row = rows[0];

  if (row === undefined) return yield* Effect.die("The device's meta row is missing");

  return {
    clientId: row.client_id,
    syncEpoch: row.sync_epoch,
    lastMutationId: row.last_mutation_id,
    settledMutationId: row.settled_mutation_id,
  } satisfies Meta;
});

/** Queues a command under the next mutation id, and returns that id with the client's. */
export const append = Effect.fnUntraced(function* (entry: Omit<Command, "mutationId">) {
  const sql = yield* SqlClient.SqlClient;
  const args = yield* Effect.fromResult(CanonicalJson.encode(entry.args));

  const [next] = yield* sql<{ readonly client_id: string; readonly last_mutation_id: number }>`
    update sync_meta set last_mutation_id = last_mutation_id + 1 where id = 1
    returning client_id, last_mutation_id
  `;

  if (next === undefined) return yield* Effect.die("The device's meta row is missing");
  const mutationId = next.last_mutation_id;

  yield* sql`
    insert into sync_outbox (mutation_id, name, version, args, at, mode)
    values (${mutationId}, ${entry.name}, ${entry.version}, ${args}, ${entry.at}, ${entry.mode})
  `;

  return { clientId: next.client_id, mutationId };
});

/** The commands waiting for the server, oldest first. */
export const pending = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rows = yield* decodeCommands(
    yield* sql`select mutation_id, name, version, args, at, mode from sync_outbox order by mutation_id`,
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
