import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

/**
 * Drizzle's query builder on Effect's `PgClient`. Both share one pool, and a query inside
 * `sql.withTransaction` joins that transaction (ADR 0012).
 */
export class Drizzle extends Context.Service<Drizzle, PgDrizzle.EffectPgDatabase>()(
  "Database.Drizzle",
) {}

/**
 * Postgres from `DATABASE_URL`: `SqlClient`, `PgClient` and `Drizzle`. The URL must reach a session,
 * not a transaction pooler, because advisory locks and `LISTEN` need one.
 */
export const layer = Layer.effect(Drizzle)(PgDrizzle.makeWithDefaults()).pipe(
  Layer.provideMerge(PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })),
);

export * as Database from "./Database.ts";
