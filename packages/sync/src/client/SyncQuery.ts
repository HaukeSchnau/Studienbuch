/**
 * A live query over the device's views: a typed Drizzle query, the tables it reads and the schema
 * of a result row. The engine invalidates a `Reactivity` key per table after every local write,
 * pull and rebase, so the query's atom runs again whenever one of its tables may have changed.
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
import type * as SqlClient from "effect/sql/SqlClient";
import type { Sync } from "../definition/Sync.ts";
import { DeviceDatabase } from "./DeviceDatabase.ts";

export * as SyncQuery from "./SyncQuery.ts";

export interface SyncQuery<Param, A, E> {
  /** The `Reactivity` keys whose invalidation runs the query again: the names of its tables. */
  readonly keys: ReadonlyArray<string>;
  readonly run: (param: Param) => Effect.Effect<ReadonlyArray<A>, E, SqlClient.SqlClient>;
}

export const make = <Param, Row, A, E>(options: {
  readonly tables: ReadonlyArray<Sync.Any>;
  readonly query: (
    db: DeviceDatabase.Database,
    param: Param,
  ) => Effect.Effect<ReadonlyArray<Row>, E>;
  /** Decodes one row as the view returns it: each field in its JSON encoding. */
  readonly result: Schema.Codec<A, Row>;
}): SyncQuery<Param, A, E | Schema.SchemaError> => {
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
 * One atom per parameter, run on `runtime`, which provides the device's `SqlClient` and the
 * engine's `Reactivity`. The atom reruns the query on that `Reactivity`, so a device's writes
 * rerun only its own queries.
 */
export const family = <R, ER, Param, A, E>(
  runtime: Atom.AtomRuntime<R | SqlClient.SqlClient, ER>,
  query: SyncQuery<Param, A, E>,
) => Atom.family((param: Param) => runtime.atom(Reactivity.stream(query.run(param), query.keys)));
