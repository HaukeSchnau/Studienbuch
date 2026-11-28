import * as PgClient from "@effect/sql-pg/PgClient";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { Pool } from "pg";

/**
 * Drizzle's query builder on Effect's `PgClient`. Both share one pool, and a query inside
 * `sql.withTransaction` joins that transaction (ADR 0012).
 */
export class Drizzle extends Context.Service<Drizzle, PgDrizzle.EffectPgDatabase>()(
  "Database.Drizzle",
) {}

// The pools beside `serve`'s own: `prepare`'s, an operator's console's and Better Auth's.
const command = 2;
const auth = 2;

// `serve`'s pool holds two connections for good, `LISTEN`'s and the cluster runner's shard lock
// session (Jobs.ts), so queries need a third.
const minimum = 2 * command + auth + 3;

/**
 * How many connections each process opens at most, out of `DATABASE_CONNECTIONS`: what the host
 * lets the database's role hold, 40 unless the deploy says otherwise. `serve` takes what `prepare`,
 * a console and Better Auth leave, so the role never refuses one of them.
 */
export const connections = Config.schema(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(minimum)),
  "DATABASE_CONNECTIONS",
).pipe(
  Config.withDefault(40),
  Config.map((total) => ({ serve: total - 2 * command - auth, auth, command })),
);

/**
 * Postgres writes a date or a timestamp as text in the session's `DateStyle`, which the database or
 * its role may set. Every pool pins it, so `day::text` reads `2026-11-28` and node-postgres parses
 * Better Auth's timestamps. The value has no space, because `options` splits on spaces.
 */
export const startupOptions = "-c datestyle=ISO,YMD";

const make = (process: "serve" | "command") =>
  Layer.effect(Drizzle)(PgDrizzle.makeWithDefaults()).pipe(
    Layer.provideMerge(
      PgClient.layerConfig({
        url: Config.Redacted("DATABASE_URL"),
        maxConnections: Config.map(connections, (pools) => pools[process]),
        startupOptions: Config.succeed(startupOptions),
      }),
    ),
  );

/**
 * Postgres from `DATABASE_URL`: `SqlClient`, `PgClient` and `Drizzle`, for `serve`. The URL must
 * reach a session, not a transaction pooler, because advisory locks and `LISTEN` need one.
 */
export const layer = make("serve");

/** The same for `prepare`, `verify` and the console, which run one statement after another. */
export const commandLayer = make("command");

/** Better Auth's own pool, beside Effect's client: auth queries are rare (stack.md). */
export const authPool = Effect.gen(function* () {
  const url = yield* Config.Redacted("DATABASE_URL");
  const { auth } = yield* connections;

  return yield* Effect.acquireRelease(
    Effect.sync(
      () => new Pool({ connectionString: Redacted.value(url), max: auth, options: startupOptions }),
    ),
    (pool) => Effect.promise(() => pool.end()),
  );
});

export * as Database from "./Database.ts";
