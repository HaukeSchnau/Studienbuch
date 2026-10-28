/**
 * The device's `Tx`: reads see the server's rows with the outbox's effect on top, writes go to the
 * overlay. The same SQL runs on every SQLite build the app ships (expo-sqlite on iOS and Android,
 * Effect's wasm client on the web), so it stays within SQLite 3.50.
 *
 * Run it inside the transaction that also writes the outbox:
 *
 * ```ts
 * sql.withTransaction(mutator.run(args).pipe(Effect.provide(SqliteTx.layer)))
 * ```
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as SqlClient from "effect/sql/SqlClient";
import { Tx } from "../transaction/Tx.ts";

export * as SqliteTx from "./SqliteTx.ts";

export const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  return Tx.make({
    read: (space, table, id) =>
      sql<{ readonly data: string }>`
        select data from sync_row_view where space = ${space} and tbl = ${table} and id = ${id}
      `.pipe(Effect.map((rows) => Option.map(Option.fromNullishOr(rows[0]), (row) => row.data))),

    list: (space, table, filter) =>
      filter === undefined
        ? sql<{ readonly id: string; readonly data: string }>`
            select id, data from sync_row_view where space = ${space} and tbl = ${table}
            order by id
          `
        : listByIndex(sql, space, table, filter),

    write: (space, table, id, data) =>
      sql`
        insert into pending_row (space, tbl, id, data) values (${space}, ${table}, ${id}, ${data})
        on conflict (space, tbl, id) do update set data = excluded.data
      `.pipe(Effect.asVoid),
  });
});

export const layer = Layer.effect(Tx.Service, make);

/**
 * `->` compares the field's JSON text, which is exact because rows are stored canonical. `->>`
 * alone would match `true` against `1` and an object against a string holding its JSON, but the
 * device's index on a scalar field is on `->>` (`DeviceSchema`), so the query names both. SQLite
 * uses a partial expression index only when the query repeats the table name and path as literals.
 */
const listByIndex = (
  sql: SqlClient.SqlClient,
  space: string,
  table: string,
  filter: Tx.StoreFilter,
) => {
  const path = literal(indexPath(filter.field));

  return sql.unsafe<{ readonly id: string; readonly data: string }>(
    `select id, data from sync_row_view
     where space = ? and tbl = ${literal(table)} and data ->> ${path} = ? and data -> ${path} = ?
     order by id`,
    [space, scalar(filter), filter.json],
  );
};

/** The JSON path of a top-level field, as the device's views and indexes write it. */
export const indexPath = (field: string) => `$."${field}"`;

const literal = (text: string) => `'${text.replaceAll("'", "''")}'`;

// What `->>` returns for a JSON value: text, a number, 1 or 0 for a boolean, the JSON text of an
// object or array.
const scalar = (filter: Tx.StoreFilter): string | number => {
  const { value } = filter;

  if (Predicate.isString(value) || Predicate.isNumber(value)) return value;

  if (Predicate.isBoolean(value)) return value ? 1 : 0;

  return filter.json;
};
