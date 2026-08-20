import { migrate } from "drizzle-orm/effect-postgres/migrator";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { fileURLToPath } from "node:url";
import { Database } from "./database.ts";
import { environmentVariables, migrationsSchema, migrationsTable } from "./project.ts";

/**
 * Directory holding the generated migration history.
 *
 * Resolves next to this package's source by default, which is correct when running from the
 * workspace. A bundled server (`.output/server/index.mjs`) has no such neighbour, so the release
 * copies `drizzle/` beside the bundle and points `STUDIENBUCH_MIGRATIONS_DIR` at it.
 */
export const migrationsFolder = Config.string(environmentVariables.migrationsDirectory).pipe(
  Config.withDefault(fileURLToPath(new URL("../drizzle", import.meta.url))),
);

/**
 * Applies every pending migration. Idempotent, and safe to run on each server start: Drizzle takes
 * a PostgreSQL advisory lock, so concurrent instances of the same release serialize rather than
 * racing.
 */
export const migrateToLatest = Effect.gen(function* () {
  const database = yield* Database.Service;
  const folder = yield* migrationsFolder;
  yield* Effect.logInfo("database.migrate.started", { event: "database.migrate.started" });
  yield* migrate(database.drizzle, { migrationsFolder: folder, migrationsSchema, migrationsTable });
  yield* Effect.logInfo("database.migrate.completed", { event: "database.migrate.completed" });
}).pipe(Effect.withSpan("Database.migrateToLatest"));

export * as Migrate from "./migrate.ts";
