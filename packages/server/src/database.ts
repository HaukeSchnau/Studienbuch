import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type * as SqlError from "effect/unstable/sql/SqlError";
import { Pool } from "pg";

export interface Options {
  readonly url: Redacted.Redacted;
  readonly maxConnections?: number;
}

export class Unavailable extends Schema.TaggedError<Unavailable>()("Database.Unavailable", {
  reason: Schema.String,
}) {}

const acquirePool = (options: Options) =>
  Effect.acquireRelease(
    Effect.tryPromise({
      try: async () => {
        const pool = new Pool({
          connectionString: Redacted.value(options.url),
          application_name: "studienbuch-server",
          connectionTimeoutMillis: 5_000,
          idleTimeoutMillis: 30_000,
          max: options.maxConnections ?? 10,
        });
        await pool.query("select 1");
        return pool;
      },
      catch: (cause) =>
        Unavailable.make({
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
    }),
    (pool) => Effect.promise(() => pool.end()),
  );

/**
 * The PostgreSQL seam.
 *
 * `pool` is the raw driver handle. It exists because Better Auth's adapter cannot consume an
 * Effect-flavoured Drizzle instance, so `@stu/server/auth` hands it the pool directly. Nothing
 * outside this package should reach for it; use `drizzle` instead.
 */
export class Service extends Context.Service<Service>()("@stu/server/database/Service", {
  make: (options: Options) =>
    Effect.gen(function* () {
      const pool = yield* acquirePool(options);
      // `fromPool` reads application name and type parsers off `pool.options`; passing them here
      // would be ignored, so the pool above is the only place either is configured.
      const client = yield* PgClient.fromPool({ acquire: Effect.succeed(pool) });
      const drizzle = yield* PgDrizzle.makeWithDefaults().pipe(
        Effect.provideService(PgClient.PgClient, client),
      );
      const ping = Effect.tryPromise({
        try: async () => {
          await pool.query("select 1");
        },
        catch: (cause) =>
          Unavailable.make({ reason: cause instanceof Error ? cause.message : String(cause) }),
      });
      return { drizzle, pool, ping };
    }),
}) {}

export const layer = (options: Options): Layer.Layer<Service, Unavailable | SqlError.SqlError> =>
  Layer.effect(Service, Service.make(options)).pipe(Layer.provide(Reactivity.layer));

export const layerConfig: Layer.Layer<
  Service,
  Config.ConfigError | Unavailable | SqlError.SqlError
> = Layer.unwrap(
  Effect.gen(function* () {
    const url = yield* Config.redacted("DATABASE_URL");
    return layer({ url });
  }),
);

export * as Database from "./database.ts";
