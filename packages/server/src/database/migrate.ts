import { migrate } from "drizzle-orm/effect-postgres/migrator";
import { logInfoEvent } from "@stu/observability";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { fileURLToPath } from "node:url";
import { Database } from "./client.ts";
import { migrationsSchema, migrationsTable } from "./migration-history.ts";

/**
 * Directory holding the generated migration history.
 *
 * Resolves next to this package's source by default, which is correct when running from the
 * workspace. A bundled server (`.output/server/index.mjs`) has no such neighbour, so the release
 * copies `drizzle/` beside the bundle and points `STUDIENBUCH_MIGRATIONS_DIR` at it.
 */
export const migrationsFolder = Config.string("STUDIENBUCH_MIGRATIONS_DIR").pipe(
  Config.withDefault(fileURLToPath(new URL("../../drizzle", import.meta.url))),
);

/**
 * Applies every pending migration. Idempotent and safe to retry: Drizzle takes a PostgreSQL
 * advisory lock, so concurrent invocations serialize rather than racing.
 */
export const migrateToLatest = Effect.gen(function* () {
  const database = yield* Database.Service;
  const folder = yield* migrationsFolder;
  yield* logInfoEvent("database.migrate.started");
  yield* migrate(database.drizzle, { migrationsFolder: folder, migrationsSchema, migrationsTable });
  yield* logInfoEvent("database.migrate.completed");
}).pipe(Effect.withSpan("Database.migrateToLatest"));

export * as Migrate from "./migrate.ts";
