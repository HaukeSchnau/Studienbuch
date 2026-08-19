import { PgClient } from "@effect/sql-pg";
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres";
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

export interface Interface {
  readonly drizzle: EffectPgDatabase;
  readonly pool: Pool;
  /**
   * Round-trips a trivial query so callers can distinguish "the pool was built once" from "the
   * database is answering now". Readiness probes need the second.
   */
  readonly ping: Effect.Effect<void, Unavailable>;
}

export class Service extends Context.Service<Service, Interface>()(
  "@stu/server/database/Service",
) {}

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

export const layer = (options: Options): Layer.Layer<Service, Unavailable | SqlError.SqlError> =>
  Layer.effect(
    Service,
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
      return Service.of({ drizzle, pool, ping });
    }),
  ).pipe(Layer.provide(Reactivity.layer));

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
