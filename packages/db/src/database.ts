import type { DatabaseError as BaseDatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import { type DatabaseService, makeService } from "@schnau/effect-drizzle/postgres";
import { Effect, Layer, Redacted } from "effect";
import type pg from "pg";
import { env } from "../env";
import * as Schema from "./schema";

export type DatabaseError = BaseDatabaseError<pg.DatabaseError>;

export class Database extends Effect.Tag("db/Database")<Database, DatabaseService<typeof Schema>>() {
  static readonly asTransaction = <E, R>(prev: Effect.Effect<void, DatabaseError | E, Database | R>) =>
    Database.use((db) => db.transaction(prev));

  static readonly asTransactionCustom =
    (dbEffect: Effect.Effect<DatabaseService<typeof Schema>>) =>
    <E, R>(prev: Effect.Effect<void, DatabaseError | E, R>) =>
      dbEffect.pipe(Effect.andThen((db) => db.transaction(prev)));
}

export const DatabaseLive = Layer.scoped(
  Database,
  makeService(
    {
      url: Redacted.make(env.MANAGEMENT_DATABASE_URL),
      ssl: false,
      schema: Schema,
    },
    Database,
  ),
);
