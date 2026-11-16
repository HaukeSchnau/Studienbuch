/**
 * A live query over the device's views: what it reads and how to run it. The engine invalidates a
 * `Reactivity` key per table after every local write, pull and rebase, and its own queries' keys
 * when their tables change, so the query's atom runs again whenever something it reads may have
 * changed, and only then.
 *
 * ```ts
 * export const dueOn = SyncQuery.make({
 *   tables: [Homework.Row],
 *   query: (db, day: string) => db.select().from(Homework).where(eq(Homework.dueOn, day)),
 *   result: DueHomework,
 * })
 * export const dueOnAtom = SyncQuery.family(runtime, dueOn) // dueOnAtom("2026-11-02")
 * ```
 */
import * as Effect from "effect/Effect";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";
import type { Sync } from "../definition/Sync.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";

export * as SyncQuery from "./SyncQuery.ts";

export interface SyncQuery<Param, A, E> {
  /** The `Reactivity` keys whose invalidation runs the query again. */
  readonly keys: ReadonlyArray<string>;
  readonly run: (param: Param) => Effect.Effect<A, E, SqlClient.SqlClient>;
}

/** One Drizzle select over `tables`, each row decoded with `result`. */
export const make = <Param, Row, A, E>(options: {
  readonly tables: ReadonlyArray<Sync.Any>;
  readonly query: (
    db: DeviceDatabase.Database,
    param: Param,
  ) => Effect.Effect<ReadonlyArray<Row>, E>;
  /** Decodes one row as the view returns it: each field in its JSON encoding. */
  readonly result: Schema.Codec<A, Row>;
}): SyncQuery<Param, ReadonlyArray<A>, E | Schema.SchemaError> => {
  const decode = Schema.decodeEffect(Schema.Array(options.result));

  return {
    keys: options.tables.map((table) => table.name),
    run: (param) =>
      Effect.flatMap(DeviceDatabase.make, (db) => options.query(db, param)).pipe(
        Effect.flatMap(decode),
      ),
  };
};

/**
 * A screen's read over several tables and the engine's queries, in one transaction, so it never
 * sees half of a pull. `tables` and `queries` name everything `run` reads and are its keys: a write
 * elsewhere doesn't run it again.
 */
export const read = <A, E, Param = void>(options: {
  readonly tables: ReadonlyArray<Sync.Any>;
  readonly queries?: ReadonlyArray<SyncQuery<never, unknown, unknown>>;
  readonly run: (param: Param) => Effect.Effect<A, E, SqlClient.SqlClient>;
}): SyncQuery<Param, A, E | SqlError.SqlError> => ({
  keys: [
    ...new Set([
      ...options.tables.map((table) => table.name),
      ...(options.queries ?? []).flatMap((query) => query.keys),
    ]),
  ],
  run: (param) =>
    Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(options.run(param))),
});

/**
 * One atom per parameter, run on `runtime`, which provides the device's `SqlClient` and the
 * engine's `Reactivity`. The atom reruns the query on that `Reactivity`, so a device's writes
 * rerun only its own queries.
 */
export const family = <R, ER, Param, A, E>(
  runtime: Atom.AtomRuntime<R | SqlClient.SqlClient, ER>,
  query: SyncQuery<Param, A, E>,
) => Atom.family((param: Param) => runtime.atom(Reactivity.stream(query.run(param), query.keys)));
