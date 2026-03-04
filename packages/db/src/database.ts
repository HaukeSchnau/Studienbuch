import type { DatabaseError as BaseDatabaseError } from "@schnau/effect-drizzle/generic-sqlite";
import { type DatabaseService, makeService } from "@schnau/effect-drizzle/postgres";
import { Effect, Layer, Redacted, ServiceMap } from "effect";
import type pg from "pg";
import { env } from "../env";
import * as Schema from "./schema";

export type DatabaseError = BaseDatabaseError<pg.DatabaseError>;

export class Database extends ServiceMap.Service<Database, DatabaseService<typeof Schema>>()("db/Database") {
  static readonly asTransaction = <E, R>(prev: Effect.Effect<void, DatabaseError | E, Database | R>) =>
    Effect.service(Database).pipe(Effect.flatMap((db) => db.transaction(prev)));

  static readonly asTransactionCustom =
    (dbEffect: Effect.Effect<DatabaseService<typeof Schema>>) =>
    <E, R>(prev: Effect.Effect<void, DatabaseError | E, R>) =>
      dbEffect.pipe(Effect.flatMap((db) => db.transaction(prev)));
}

export const DatabaseLive = Layer.effect(
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
