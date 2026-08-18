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
import { Pool, types } from "pg";

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
}

export class Service extends Context.Service<Service, Interface>()("@stu/server/Database") {}

const postgresDateTypeIds = new Set([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182]);

const typeParsers = {
  getTypeParser: (typeId: number, format?: "text" | "binary") =>
    postgresDateTypeIds.has(typeId)
      ? (value: string) => value
      : types.getTypeParser(typeId, format),
};

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
          types: typeParsers,
        });
        await pool.query("select 1");
        return pool;
      },
      catch: (cause) =>
        new Unavailable({
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
      const client = yield* PgClient.fromPool({
        acquire: Effect.succeed(pool),
        applicationName: "studienbuch-server",
        types: typeParsers,
      });
      const drizzle = yield* PgDrizzle.makeWithDefaults().pipe(
        Effect.provideService(PgClient.PgClient, client),
      );
      return Service.of({ drizzle, pool });
    }).pipe(Effect.provide(Reactivity.layer)),
  );

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
