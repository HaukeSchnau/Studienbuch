import { type DatabaseError, type DatabaseService, makeService } from "@schnau/effect-drizzle/postgres";
import { Effect, Layer, Redacted } from "effect";
import { env } from "../env";
import * as Schema from "./schema";

export class Database extends Effect.Tag("db/Database")<Database, DatabaseService<typeof Schema>>() {
  static readonly asTransaction = <E, R>(prev: Effect.Effect<void, DatabaseError | E, Database | R>) =>
    Database.use((db) => db.transaction(prev));
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

export type { DatabaseError } from "@schnau/effect-drizzle/postgres";
