import { SyncEpoch } from "@stu/sync/server";
import { Postgres18 } from "@stu/sync/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as SqlClient from "effect/sql/SqlClient";
import { Migrations } from "./Migrations.ts";

export * as DatabaseTesting from "./DatabaseTesting.ts";

/**
 * Waits until a transaction in this database waits for another's lock. It asks again at once,
 * because nothing else could tell.
 */
export const someoneWaits = Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
    select 1 from pg_stat_activity
    where datname = current_database() and wait_event_type = 'Lock'
  `,
).pipe(Effect.repeat({ until: (rows) => rows.length > 0 }));

/**
 * A fresh database on the test run's PostgreSQL 18 at the release's schema, as `prepare` leaves it
 * before any seed. Each build is a database of its own.
 */
export const prepared = Layer.effectDiscard(
  Effect.gen(function* () {
    const path = yield* Path.Path;
    yield* Migrations.apply(
      yield* Migrations.read(path.join(import.meta.dirname, "../../../migrations")),
    );
    yield* SyncEpoch.initialize;
  }),
).pipe(Layer.provideMerge(Postgres18.database(Postgres18.socket ?? "")));
