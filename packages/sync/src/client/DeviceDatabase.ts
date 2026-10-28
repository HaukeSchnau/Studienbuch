/**
 * Drizzle on the device's Effect `SqlClient`, whichever SQLite build provides it: Effect's wasm
 * client on the web, our expo-sqlite adapter on iOS and Android, Effect's node client in tests.
 * Queries are Effects on the caller's fiber, so they join its transaction and fail with typed
 * errors.
 *
 * ```ts
 * const db = yield* DeviceDatabase.make;
 * const rows = yield* db.select().from(Homework).where(eq(Homework.courseId, courseId));
 * ```
 *
 * It uses the session of Drizzle's `effect-sqlite-wasm` driver, which calls only
 * `SqlClient.unsafe` and `SqlClient.withTransaction`, without the driver's entry point, which would
 * import the wasm client into the native bundle to look up its service tag.
 */
import { EffectCache } from "drizzle-orm/cache/core/cache-effect";
import { EffectLogger } from "drizzle-orm/effect-core/logger";
import { effectSQLiteWasmCodecs } from "drizzle-orm/effect-sqlite-wasm/codecs";
import { migrate as drizzleMigrate } from "drizzle-orm/effect-sqlite-wasm/migrator";
import { EffectSQLiteWasmSession } from "drizzle-orm/effect-sqlite-wasm/session";
import { SQLiteDialect } from "drizzle-orm/sqlite-core/dialect";
import { SQLiteEffectDatabase } from "drizzle-orm/sqlite-core/effect/db";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";

export * as DeviceDatabase from "./DeviceDatabase.ts";

export const make = Effect.gen(function* () {
  const client = yield* SqlClient.SqlClient;
  const dialect = new SQLiteDialect({ codecs: effectSQLiteWasmCodecs });

  const session = new EffectSQLiteWasmSession(
    // The session's type names the wasm client, but it only uses the `SqlClient` part.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see above
    client as ConstructorParameters<typeof EffectSQLiteWasmSession>[0],
    dialect,
    {},
    { logger: yield* EffectLogger, cache: yield* EffectCache },
  );

  return new SQLiteEffectDatabase(dialect, session, {});
}).pipe(Effect.provide(Layer.merge(EffectLogger.Default, EffectCache.Default)));

export type Database = Effect.Success<typeof make>;

/**
 * Applies drizzle-kit's migrations, keyed by their folder names. On Metro they come from the
 * `migrations.js` that drizzle-kit writes with `driver: "expo"`, which inlines each SQL file.
 */
export const migrate = (migrations: Readonly<Record<string, string>>) =>
  Effect.flatMap(make, (db) =>
    drizzleMigrate(db as Parameters<typeof drizzleMigrate>[0], { migrations: { ...migrations } }),
  );
