/**
 * The engine's tables in an empty database, for tests and the simulation on PostgreSQL 18 and
 * PGlite. drizzle-kit writes the statements from `Tables.ts` the same way it wrote the migrations
 * `apps/server` ships, so neither side holds DDL by hand. Node only, and never part of the server
 * bundle: drizzle-kit is a development dependency.
 */
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api-postgres";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";
import { SyncEpoch } from "./SyncEpoch.ts";
import { Tables } from "./Tables.ts";

export * as ServerDatabase from "./ServerDatabase.ts";

const statements = Effect.all([
  Effect.promise(() => generateDrizzleJson({})),
  Effect.promise(() => generateDrizzleJson(Tables.all)),
]).pipe(
  Effect.flatMap(([empty, tables]) => Effect.promise(() => generateMigration(empty, tables))),
);

/** Creates the engine's tables and writes the restore epoch, as `prepare` does on a host. */
export const create = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  for (const statement of yield* statements) yield* sql.unsafe(statement);
  yield* SyncEpoch.initialize;
}).pipe(Effect.withSpan("ServerDatabase.create"));
