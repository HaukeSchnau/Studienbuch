import type { DatabaseError, GenericDatabaseService, GenericSqliteError } from "@schnau/effect-drizzle/generic-sqlite";
import type * as Schema from "./schema";
import { Effect } from "effect";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

export class Database extends Effect.Tag("student/Database")<Database, GenericDatabaseService<typeof Schema>>() {
  static readonly asTransaction = <E, R>(
    prev: Effect.Effect<void, DatabaseError<GenericSqliteError> | E, Database | R>,
  ) => Database.use((db) => db.transaction(prev));
}

export type DatabaseClient = BaseSQLiteDatabase<"sync" | "async", unknown, typeof Schema>;
