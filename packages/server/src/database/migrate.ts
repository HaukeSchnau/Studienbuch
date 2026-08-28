import { migrate } from "drizzle-orm/effect-postgres/migrator";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { logInfoEvent } from "@stu/observability";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { fileURLToPath } from "node:url";
import { Database } from "./client.ts";
import { migrationsSchema, migrationsTable } from "./migration-history.ts";

interface AppliedMigration {
  readonly name: string;
  readonly hash: string;
}

export interface MigrationHistoryMismatch {
  readonly name: string;
  readonly appliedHash: string;
  readonly localHash: string | null;
}

export class HistoryUnreadable extends Schema.TaggedError<HistoryUnreadable>()(
  "Database.MigrationHistoryUnreadable",
  { reason: Schema.String },
) {}

export class HistoryMismatch extends Schema.TaggedError<HistoryMismatch>()(
  "Database.MigrationHistoryMismatch",
  {
    name: Schema.String,
    appliedHash: Schema.String,
    localHash: Schema.NullOr(Schema.String),
  },
) {}

export const findMigrationHistoryMismatch = (
  localMigrations: ReadonlyArray<Pick<MigrationMeta, "name" | "hash">>,
  appliedMigrations: ReadonlyArray<AppliedMigration>,
): MigrationHistoryMismatch | undefined => {
  const localHashes = new Map(localMigrations.map(({ name, hash }) => [name, hash]));
  for (const applied of appliedMigrations) {
    const localHash = localHashes.get(applied.name) ?? null;
    if (localHash !== applied.hash) {
      return { name: applied.name, appliedHash: applied.hash, localHash };
    }
  }
  return undefined;
};

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

type DatabaseClient = Effect.Success<typeof Database.Service>;

const readAppliedMigrations = (database: DatabaseClient) =>
  Effect.tryPromise({
    try: async () => {
      const history = await database.pool.query<{
        tableExists: boolean;
        nameExists: boolean;
      }>(
        `select
           exists(select 1 from information_schema.tables
             where table_schema = $1 and table_name = $2) as "tableExists",
           exists(select 1 from information_schema.columns
             where table_schema = $1 and table_name = $2 and column_name = 'name') as "nameExists"`,
        [migrationsSchema, migrationsTable],
      );
      // TODO: Remove the name-column branch after every long-lived database has passed through
      // Drizzle's version-zero migration-table upgrade.
      const currentHistory = history.rows[0];
      if (!currentHistory?.tableExists || !currentHistory.nameExists) return [];
      const result = await database.pool.query<AppliedMigration>(
        `select name, hash from ${migrationsSchema}.${migrationsTable} where name is not null`,
      );
      return result.rows;
    },
    catch: (cause) =>
      HistoryUnreadable.make({ reason: cause instanceof Error ? cause.message : String(cause) }),
  });

const validateMigrationHistory = (database: DatabaseClient, folder: string) =>
  Effect.gen(function* () {
    const localMigrations = yield* Effect.try({
      try: () => readMigrationFiles({ migrationsFolder: folder }),
      catch: (cause) =>
        HistoryUnreadable.make({ reason: cause instanceof Error ? cause.message : String(cause) }),
    });
    const appliedMigrations = yield* readAppliedMigrations(database);
    const mismatch = findMigrationHistoryMismatch(localMigrations, appliedMigrations);
    if (mismatch !== undefined) return yield* HistoryMismatch.make(mismatch);
  });

/**
 * Refuses edited or deleted applied migrations, then applies every pending migration.
 */
export const migrateToLatest = Effect.gen(function* () {
  const database = yield* Database.Service;
  const folder = yield* migrationsFolder;
  yield* logInfoEvent("database.migrate.started");
  yield* validateMigrationHistory(database, folder);
  yield* migrate(database.drizzle, { migrationsFolder: folder, migrationsSchema, migrationsTable });
  yield* logInfoEvent("database.migrate.completed");
}).pipe(Effect.withSpan("Database.migrateToLatest"));

export * as Migrate from "./migrate.ts";
