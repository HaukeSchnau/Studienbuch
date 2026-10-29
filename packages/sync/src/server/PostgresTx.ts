/**
 * The server's `Tx` on Postgres. The first write to a space in a transaction bumps the space's
 * version under its row lock, and every row the transaction writes there carries that version, so
 * version order equals commit order (sync.md, section 1). Deletes leave a tombstone.
 *
 * Provide a fresh layer per transaction, because the bumped versions belong to it:
 *
 * ```ts
 * sql.withTransaction(mutator.run(args).pipe(Effect.provide(PostgresTx.layer(runner))))
 * ```
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { Tx } from "../transaction/Tx.ts";

export * as PostgresTx from "./PostgresTx.ts";

/**
 * Ids sort in C collation, which is UTF-8 byte order like SQLite's. A database created with an ICU
 * or glibc locale would otherwise put `_c` before `B` and list rows in another order than the
 * device.
 */
export const schema = [
  `create table if not exists space (
    id text collate "C" primary key,
    version bigint not null
  )`,
  `create table if not exists sync_row (
    space_id text collate "C" not null,
    tbl text collate "C" not null,
    id text collate "C" not null,
    version bigint not null,
    data jsonb,
    primary key (space_id, tbl, id)
  )`,
  `create index if not exists sync_row_space_version on sync_row (space_id, version)`,
];

/** The server's `Tx` for a command of the connection's account, or for the server's own writes. */
export const make = Effect.fnUntraced(function* (runner: Tx.Runner) {
  const sql = yield* SqlClient.SqlClient;
  const versions = new Map<string, string>();

  const version = (space: string) => {
    const known = versions.get(space);

    if (known !== undefined) return Effect.succeed(known);

    return sql<{ readonly version: string }>`
      insert into space (id, version) values (${space}, 1)
      on conflict (id) do update set version = space.version + 1
      returning version::text
    `.pipe(
      Effect.flatMap(([row]) =>
        row === undefined
          ? Effect.die("the version bump returned no row")
          : Effect.succeed(row.version),
      ),
      Effect.tap((bumped) => Effect.sync(() => versions.set(space, bumped))),
    );
  };

  return Tx.make({
    ...runner,
    location: "server",

    read: (space, table, id) =>
      sql<{ readonly data: string }>`
        select data::text as data from sync_row
        where space_id = ${space} and tbl = ${table} and id = ${id} and data is not null
      `.pipe(Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), (row) => row.data))),

    list: (space, table, filter) =>
      filter === undefined
        ? sql<{ readonly id: string; readonly data: string }>`
            select id, data::text as data from sync_row
            where space_id = ${space} and tbl = ${table} and data is not null
            order by id
          `
        : sql<{ readonly id: string; readonly data: string }>`
            select id, data::text as data from sync_row
            where space_id = ${space} and tbl = ${table}
              and data -> (${filter.field}::text) = ${filter.json}::jsonb
            order by id
          `,

    write: (space, table, id, data) =>
      Effect.flatMap(
        version(space),
        (bumped) => sql`
          insert into sync_row (space_id, tbl, id, version, data)
          values (${space}, ${table}, ${id}, ${bumped}::bigint, ${data}::jsonb)
          on conflict (space_id, tbl, id)
          do update set version = excluded.version, data = excluded.data
        `,
      ).pipe(Effect.asVoid),
  });
});

export const layer = (runner: Tx.Runner) => Layer.effect(Tx.Service, make(runner));
