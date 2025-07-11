import type { DatabaseError, GenericDatabaseService, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type * as Schema from "./schema";
import { Effect } from "effect";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

export class Database extends Effect.Tag("Database")<Database, GenericDatabaseService<typeof Schema>>() {
  static readonly asTransaction = (prev: Effect.Effect<void, DatabaseError<GenericSqliteError>, Database>) =>
    Database.use((db) => db.transaction(prev));
}

export type DatabaseClient = BaseSQLiteDatabase<"sync" | "async", unknown, typeof Schema>;
