/**
 * The device's copy of the server and its overlay. `base_row` holds only rows the server sent,
 * and `pending_row` only the effect of the outbox, so after every pull the views show the
 * server's rows plus a replay of the outbox. Every function runs inside the caller's transaction
 * and returns the tables whose rows it changed, which the caller invalidates after the commit.
 */
import type { SpaceKey } from "@stu/e2ee";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";
import { Sync } from "../definition/Sync.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Refusal } from "../protocol/Refusal.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";
import { Keyring } from "./Keyring.ts";
import { Outbox } from "./Outbox.ts";
import { Sealing } from "./Sealing.ts";
import { SqliteTx } from "./SqliteTx.ts";

export * as Rebase from "./Rebase.ts";

/** The tables holding rows of `spaces`, before the caller deletes them. */
const tablesOf = Effect.fnUntraced(function* (spaces: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;

  if (spaces.length === 0) return [];

  const rows = yield* sql<{ readonly tbl: string }>`
    select distinct tbl from base_row where ${sql.in("space", spaces)}
  `;

  return rows.map((row) => row.tbl);
});

// A batch of rows travels to SQLite as one JSON array, which is one statement and on the web one
// worker message, however many rows a patch holds.
const batch = (rows: ReadonlyArray<Schema.Json>) =>
  Effect.orDie(Effect.fromResult(CanonicalJson.encode(rows)));

/** What applying a pull needs from the keyring to take sealed rows. */
export interface Opener {
  /** The epoch keys a key box carries for this device's account, or none. */
  readonly openBox: (
    space: string,
    data: Schema.Json,
  ) => Effect.Effect<ReadonlyArray<SpaceKey.EpochKey>, SqlError.SqlError, SqlClient.SqlClient>;
  /** A sealed row's table and JSON, or `None` to park it. */
  readonly openRow: (
    space: string,
    id: string,
    envelope: Schema.Json,
    ct: Uint8Array,
  ) => Effect.Effect<Option.Option<Keyring.Opened>, SqlError.SqlError, SqlClient.SqlClient>;
}

/** Removes the base row of a sealed row, whose table only the device knows. */
const forgetSealed = Effect.fnUntraced(function* (space: string, id: string) {
  const sql = yield* SqlClient.SqlClient;

  const [old] = yield* sql<{ readonly tbl: string | null }>`
    delete from sync_sealed_row where space = ${space} and id = ${id} returning tbl
  `;

  if (old?.tbl === null || old?.tbl === undefined) return Option.none<string>();
  yield* sql`delete from base_row where space = ${space} and tbl = ${old.tbl} and id = ${id}`;

  return Option.some(old.tbl);
});

/** Stores a sealed row opened into its base row, or parked as envelope and ciphertext. */
const placeSealed = Effect.fnUntraced(function* (
  opener: Opener,
  row: {
    readonly space: string;
    readonly id: string;
    readonly version: number;
    readonly envelope: Schema.Json;
    readonly ct: Uint8Array;
  },
) {
  const sql = yield* SqlClient.SqlClient;
  const opened = yield* opener.openRow(row.space, row.id, row.envelope, row.ct);

  const json = Option.flatMap(opened, (each) =>
    Result.getSuccess(CanonicalJson.normalize(each.json)),
  );

  if (Option.isSome(opened) && Option.isSome(json)) {
    const table = opened.value.table;

    yield* sql`
      insert into base_row (space, tbl, id, version, data)
      values (${row.space}, ${table}, ${row.id}, ${row.version}, ${json.value})
      on conflict (space, tbl, id) do update set version = excluded.version, data = excluded.data
    `;
    yield* sql`
      insert into sync_sealed_row (space, id, version, tbl, envelope, ct)
      values (${row.space}, ${row.id}, ${row.version}, ${table}, null, null)
      on conflict (space, id) do update set version = excluded.version, tbl = excluded.tbl,
        envelope = null, ct = null
    `;

    return Option.some(table);
  }

  const envelope = yield* Effect.orDie(Effect.fromResult(CanonicalJson.encode(row.envelope)));

  yield* sql`
    insert into sync_sealed_row (space, id, version, tbl, envelope, ct)
    values (${row.space}, ${row.id}, ${row.version}, null, ${envelope}, ${row.ct})
    on conflict (space, id) do update set version = excluded.version, tbl = null,
      envelope = excluded.envelope, ct = excluded.ct
  `;

  return Option.none<string>();
});

const ParkedRow = Schema.Struct({
  id: Schema.String,
  version: Schema.Int,
  envelope: Schema.fromJsonString(Schema.Json),
  ct: Schema.Uint8Array,
});

const decodeParked = Schema.decodeUnknownEffect(Schema.Array(ParkedRow));

/** Opens what the keys of `space` now open: its boxes for this account, then its parked rows. */
export const reopen = Effect.fnUntraced(function* (opener: Opener, space: string) {
  const sql = yield* SqlClient.SqlClient;
  const tables = new Set<string>();

  const boxes = yield* sql<{ readonly data: string }>`
    select data from base_row where space = ${space} and tbl = ${Protocol.keyBoxTable}
  `;

  for (const box of boxes) {
    const data = yield* Effect.orDie(decodeJson(box.data));
    yield* Keyring.storeKeys(space, yield* opener.openBox(space, data));
  }

  const parked = yield* Effect.orDie(
    decodeParked(
      yield* sql`
        select id, version, envelope, ct from sync_sealed_row where space = ${space} and tbl is null
      `,
    ),
  );

  for (const row of parked) {
    const table = yield* placeSealed(opener, { space, ...row, ct: new Uint8Array(row.ct) });

    if (Option.isSome(table)) tables.add(table.value);
  }

  return tables;
});

const decodeJson = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Json));

/**
 * Writes a pull's spaces and patches into the base rows. The device keeps exactly the spaces the
 * response lists, and drops the rows of any other. A patch holds each row once. Key boxes go in
 * before sealed rows, so a row and the key it needs can arrive in one pull.
 */
export const applyPull = Effect.fnUntraced(function* (
  response: Protocol.PullResponse,
  now: number,
  opener: Opener,
) {
  const sql = yield* SqlClient.SqlClient;
  const tables = new Set<string>();
  const listed = new Set(response.spaces.map((space) => space.id));
  const known = yield* sql<{ readonly id: string }>`select id from sync_space`;

  const dropped = [
    ...new Set([
      ...known.map((row) => row.id).filter((id) => !listed.has(id)),
      ...response.removed,
    ]),
  ];

  if (dropped.length > 0) {
    for (const table of yield* tablesOf(dropped)) tables.add(table);
    yield* sql`delete from base_row where ${sql.in("space", dropped)}`;
    yield* sql`delete from sync_sealed_row where ${sql.in("space", dropped)}`;
    yield* sql`delete from sync_space_key where ${sql.in("space", dropped)}`;
    yield* sql`delete from sync_space where ${sql.in("id", dropped)}`;
  }

  const spaces = yield* batch(
    response.spaces.map((space) => ({
      id: space.id,
      kind: space.kind,
      role: space.role,
      version: space.version,
      keyEpoch: space.keyEpoch,
    })),
  );

  yield* sql`
    insert into sync_space (id, kind, role, version, key_epoch, synced_at)
    select value ->> '$.id', value ->> '$.kind', value ->> '$.role', null,
      value ->> '$.keyEpoch', null
    from json_each(${spaces}) where true
    on conflict (id) do update set kind = excluded.kind, role = excluded.role,
      key_epoch = excluded.key_epoch
  `;

  const rekeyed = new Set<string>();
  const sealed: Array<{ readonly space: string; readonly op: Protocol.Op }> = [];

  for (const patch of response.patches) {
    if (!listed.has(patch.space)) {
      return yield* Effect.die(`A pull patched ${patch.space}, which it doesn't list`);
    }

    if (patch.reset) {
      for (const table of yield* tablesOf([patch.space])) tables.add(table);
      yield* sql`delete from base_row where space = ${patch.space}`;
      yield* sql`delete from sync_sealed_row where space = ${patch.space}`;
    }

    const upserts: Array<Schema.Json> = [];
    const deletes: Array<Schema.Json> = [];

    for (const op of patch.ops) {
      // An encrypted row's table travels inside its ciphertext.
      if (op.tbl === "") {
        sealed.push({ space: patch.space, op });
        continue;
      }

      tables.add(op.tbl);

      if (op.tbl === Protocol.keyBoxTable) rekeyed.add(patch.space);

      if (op.row._tag === "Readable") {
        const data = yield* Effect.orDie(Effect.fromResult(CanonicalJson.encode(op.row.data)));
        upserts.push({ tbl: op.tbl, id: op.id, version: op.version, data });
      } else if (op.row._tag === "Deleted") {
        deletes.push({ tbl: op.tbl, id: op.id });
      } else {
        return yield* Effect.die(`A sealed row in ${patch.space} names the table ${op.tbl}`);
      }
    }

    if (upserts.length > 0) {
      // `where true` keeps SQLite from reading `on conflict` as part of the join.
      yield* sql`
        insert into base_row (space, tbl, id, version, data)
        select ${patch.space}, value ->> '$.tbl', value ->> '$.id', value ->> '$.version',
          value ->> '$.data'
        from json_each(${yield* batch(upserts)}) where true
        on conflict (space, tbl, id) do update set version = excluded.version, data = excluded.data
      `;
    }

    if (deletes.length > 0) {
      yield* sql`
        delete from base_row where space = ${patch.space} and (tbl, id) in (
          select value ->> '$.tbl', value ->> '$.id' from json_each(${yield* batch(deletes)})
        )
      `;
    }

    yield* sql`update sync_space set version = ${patch.to} where id = ${patch.space}`;
  }

  // New boxes may open parked rows from earlier pulls, and the sealed rows of this one.
  for (const space of rekeyed) {
    for (const table of yield* reopen(opener, space)) tables.add(table);
  }

  for (const { space, op } of sealed) {
    const old = yield* forgetSealed(space, op.id);

    if (Option.isSome(old)) tables.add(old.value);

    if (op.row._tag === "Sealed") {
      const table = yield* placeSealed(opener, {
        space,
        id: op.id,
        version: op.version,
        envelope: op.row.envelope,
        ct: op.row.ct,
      });

      if (Option.isSome(table)) tables.add(table.value);
    }
  }

  // A space is synced once the device holds it at the version the server listed.
  yield* sql`
    update sync_space set synced_at = ${now}
    where exists (
      select 1 from json_each(${spaces}) as listed
      where listed.value ->> '$.id' = sync_space.id
        and listed.value ->> '$.version' = sync_space.version
    )
  `;

  return tables;
});

/**
 * The refusal a sealed command's replay ended with, encoded as the server would send it. Anything
 * the mutator's or `Tx`'s codecs don't know counts as arguments this build can't run.
 */
const refusalOf = Effect.fnUntraced(function* (
  mutator: Sync.AnyMutator,
  version: number,
  cause: Cause.Cause<{ readonly _tag: string }>,
) {
  const invalid = Effect.orDie(
    encodeEngine(new Refusal.InvalidArgs({ mutator: mutator.name, version })),
  );

  const error = Cause.findErrorOption(cause);

  if (Option.isNone(error)) return yield* invalid;

  return yield* encoderOf(mutator)(error.value).pipe(
    Effect.flatMap(decodeReason),
    Effect.catchTags({ SchemaError: () => invalid }),
  );
});

const encodeEngine = Schema.encodeEffect(Refusal.Engine);

// A mutator's own refusals and `Tx`'s, compiled once per mutator.
const encoders = new WeakMap<
  Sync.AnyMutator,
  (error: { readonly _tag: string }) => Effect.Effect<unknown, Schema.SchemaError>
>();

const encoderOf = (mutator: Sync.AnyMutator) => {
  const known = encoders.get(mutator);

  if (known !== undefined) return known;

  const encoder = Schema.encodeUnknownEffect(
    Schema.Union([mutator.error, Tx.Refused, Sealing.Unreadable]),
  );

  encoders.set(mutator, encoder);

  return encoder;
};

const decodeReason = Schema.decodeUnknownEffect(Refusal.Reason);

/**
 * Clears the overlay and runs every waiting command again, one savepoint each, so one that fails
 * loses only its own effect and stays queued. A sealed one keeps its rows as drafts for the push,
 * or its refusal, which is the verdict the server can't give. Returns the tables touched.
 */
export const replay = Effect.fnUntraced(function* (definition: Sync.Definition, actor: string) {
  const sql = yield* SqlClient.SqlClient;
  const old = yield* sql<{ readonly tbl: string }>`select distinct tbl from pending_row`;
  const tables = new Set(old.map((row) => row.tbl));
  /** The command of this replay that last wrote each sealed row, by space and id. */
  const writers = new Map<string, number>();
  const rowKey = (space: string, id: string) => JSON.stringify([space, id]);

  yield* sql`delete from pending_row`;

  // Spaces whose rows come back whole with the next pull, as after a restore of the server.
  const awaiting = new Set(
    (yield* sql<{ readonly id: string }>`select id from sync_space where version is null`).map(
      (row) => row.id,
    ),
  );

  for (const command of yield* Outbox.pending) {
    const mutator = definition.byName.mutators[command.mode].get(command.name);

    if (mutator === undefined) {
      yield* Effect.logWarning("A waiting command's mutator is missing from this build", {
        mutationId: command.mutationId,
        mutator: command.name,
      });
      continue;
    }

    // A sealed command the push sent keeps what it sent until a pull shows the server didn't take
    // it, since the server may hold it already. One in a space whose rows come back whole waits for
    // them: its rows here may be the effect it had before a restore. Their overlay still follows.
    const declared = yield* Effect.option(
      Effect.map(Sync.invoke(mutator, command.version, command.args), (each) => each.spaces),
    );

    const sent =
      command.mode === "Seal" &&
      (command.sealed !== null ||
        Option.exists(declared, (spaces) => spaces.some((space) => awaiting.has(space))));

    // A sealed command's drafts belong to its savepoint, so a row it can't read takes back its
    // effect like any other refusal.
    const exit = yield* Effect.exit(
      sql.withTransaction(
        Effect.gen(function* () {
          const invocation = yield* Sync.invoke(mutator, command.version, command.args);
          const { tx, written } = yield* SqliteTx.tracked({ actor, writes: mutator.writes });
          yield* Effect.provideService(invocation.run, Tx.Service, tx);
          const rows = written();

          const drafts =
            command.mode === "Seal" && !sent
              ? yield* Sealing.drafts(rows, (space, id) =>
                  Effect.succeed(Option.fromNullishOr(writers.get(rowKey(space, id)))),
                )
              : [];

          return { rows, drafts };
        }),
      ),
    );

    if (sent) {
      if (Exit.isSuccess(exit)) for (const row of exit.value.rows) tables.add(row.table);

      for (const draft of command.writes ?? []) {
        writers.set(rowKey(draft.space, draft.id), command.mutationId);
      }
    } else if (Exit.isSuccess(exit)) {
      for (const row of exit.value.rows) tables.add(row.table);

      if (command.mode === "Seal") {
        const { drafts } = exit.value;
        yield* Outbox.materialize(command.mutationId, drafts, null);

        for (const draft of drafts) writers.set(rowKey(draft.space, draft.id), command.mutationId);
      }
    } else {
      yield* Effect.logWarning("A waiting command fails on the newer rows", {
        mutationId: command.mutationId,
        mutator: command.name,
      });

      if (command.mode === "Seal") {
        const reason = yield* refusalOf(mutator, command.version, exit.cause);
        yield* Outbox.materialize(command.mutationId, [], reason);
      }
    }
  }

  return tables;
});

/**
 * Forgets every cursor, so each space comes back whole with the next pull. The base rows stay,
 * so the screens keep showing them, and each snapshot replaces its space's rows when it arrives.
 */
export const forgetCursors = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`update sync_space set version = null, synced_at = null`;
});

/** Drops every row and space, for a device another device removed. */
export const clear = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`delete from pending_row`;
  yield* sql`delete from base_row`;
  yield* sql`delete from sync_sealed_row`;
  yield* sql`delete from sync_space_key`;
  yield* sql`delete from sync_space`;
});
