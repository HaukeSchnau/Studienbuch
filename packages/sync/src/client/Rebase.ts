/**
 * The device's copy of the server and its overlay. `base_row` holds only rows the server sent,
 * and `pending_row` only the effect of the outbox, so after every pull the views show the
 * server's rows plus a replay of the outbox. Every function runs inside the caller's transaction
 * and returns the tables whose rows it changed, which the caller invalidates after the commit.
 */
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import type * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { Sync } from "../definition/Sync.ts";
import type { Protocol } from "../protocol/Protocol.ts";
import { CanonicalJson } from "../transaction/CanonicalJson.ts";
import { Tx } from "../transaction/Tx.ts";
import { Outbox } from "./Outbox.ts";
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

/**
 * Writes a pull's spaces and patches into the base rows. The device keeps exactly the spaces the
 * response lists, and drops the rows of any other. A patch holds each row once.
 */
export const applyPull = Effect.fnUntraced(function* (
  response: Protocol.PullResponse,
  now: number,
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

  for (const patch of response.patches) {
    if (!listed.has(patch.space)) {
      return yield* Effect.die(`A pull patched ${patch.space}, which it doesn't list`);
    }

    if (patch.reset) {
      for (const table of yield* tablesOf([patch.space])) tables.add(table);
      yield* sql`delete from base_row where space = ${patch.space}`;
    }

    const upserts: Array<Schema.Json> = [];
    const deletes: Array<Schema.Json> = [];

    for (const op of patch.ops) {
      tables.add(op.tbl);

      if (op.row._tag === "Readable") {
        const data = yield* Effect.orDie(Effect.fromResult(CanonicalJson.encode(op.row.data)));
        upserts.push({ tbl: op.tbl, id: op.id, version: op.version, data });
      } else if (op.row._tag === "Deleted") {
        deletes.push({ tbl: op.tbl, id: op.id });
      } else {
        return yield* Effect.die("A sealed row arrived, which needs the keyring");
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
 * Clears the overlay and runs every waiting command again on the base rows, each in a savepoint
 * of its own, so a command that fails now loses only its own effect and stays queued: the server
 * decides. Returns the tables the old overlay and the replay touched.
 */
export const replay = Effect.fnUntraced(function* (definition: Sync.Definition, actor: string) {
  const sql = yield* SqlClient.SqlClient;
  const old = yield* sql<{ readonly tbl: string }>`select distinct tbl from pending_row`;
  const tables = new Set(old.map((row) => row.tbl));

  yield* sql`delete from pending_row`;

  for (const command of yield* Outbox.pending) {
    const mutator = definition.byName.mutators[command.mode].get(command.name);

    if (mutator === undefined) {
      yield* Effect.logWarning("A waiting command's mutator is missing from this build", {
        mutationId: command.mutationId,
        mutator: command.name,
      });
      continue;
    }

    const exit = yield* Effect.exit(
      sql.withTransaction(
        Effect.gen(function* () {
          const invocation = yield* Sync.invoke(mutator, command.version, command.args);
          const { tx, written } = yield* SqliteTx.tracked({ actor, writes: mutator.writes });
          yield* Effect.provideService(invocation.run, Tx.Service, tx);

          return written();
        }),
      ),
    );

    if (Exit.isSuccess(exit)) {
      for (const row of exit.value) tables.add(row.table);
    } else {
      yield* Effect.logWarning("A waiting command fails on the newer rows and waits", {
        mutationId: command.mutationId,
        mutator: command.name,
      });
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
  yield* sql`delete from sync_space`;
});
