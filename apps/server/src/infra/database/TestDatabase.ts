import * as PgClient from "@effect/sql-pg/PgClient";
import * as Config from "effect/Config";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Reactivity from "effect/reactivity/Reactivity";

/**
 * A new, empty database on the server at `DATABASE_URL` (devenv's PostgreSQL 18), dropped when the
 * layer's scope closes. Tests use it to run against real Postgres without sharing state.
 */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const url = yield* Config.Redacted("DATABASE_URL");
    const crypto = yield* Crypto.Crypto;
    const database = `test_${(yield* crypto.randomUUIDv4()).replaceAll("-", "")}`;
    const admin = yield* PgClient.make({ url, maxConnections: 1 }).pipe(
      Effect.provide(Reactivity.layer),
    );
    yield* admin`CREATE DATABASE ${admin(database)}`;
    yield* Effect.addFinalizer(() =>
      admin`DROP DATABASE ${admin(database)} WITH (FORCE)`.pipe(Effect.orDie),
    );
    return PgClient.layer({ url, database });
  }),
);

export * as TestDatabase from "./TestDatabase.ts";
