/**
 * The four databases the conformance tests compare: the device's SQLite in two builds and the
 * server's Postgres in two builds. Every engine runs a test's effect in one transaction with its
 * own `Tx`, the way a mutator runs.
 */
import { PgClient } from "@effect/sql-pg";
import { PgliteClient } from "@effect/sql-pglite";
import { SqliteClient as NodeSqliteClient } from "@effect/sql-sqlite-node";
import { SqliteClient as WasmSqliteClient } from "@effect/sql-sqlite-wasm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import type * as SqlError from "effect/sql/SqlError";
// installFileFetch reads the wasm file before any Effect runtime exists.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import { readFile } from "node:fs/promises";
import { inject } from "vitest";
import { DeviceDatabase } from "../client/DeviceDatabase.ts";
import { SqliteTx } from "../client/SqliteTx.ts";
import { PostgresTx } from "../server/PostgresTx.ts";
import type { Tx } from "../transaction/Tx.ts";
import ProbeMigrations from "./migrations/migrations.js";

export * as Engines from "./Engines.ts";

export type Name = "sqlite-wasm" | "sqlite-node" | "pglite" | "postgres-18";

export interface Engine {
  readonly name: Name;
  readonly side: "device" | "server";
  /** Runs an effect in one transaction with this engine's `Tx`. */
  readonly transaction: <A, E>(
    effect: Effect.Effect<A, E, Tx.Service>,
  ) => Effect.Effect<A, E | SqlError.SqlError>;
  /** Runs an effect against this engine's database outside the `Tx`. */
  readonly sql: <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A, E>;
}

export class Service extends Context.Service<Service, ReadonlyArray<Engine>>()(
  "@stu/sync/conformance/Engines",
) {}

/** The socket directory of the run's PostgreSQL 18, or `null` when it isn't available. */
export const postgres18 = inject("postgres18");

const engine = Effect.fnUntraced(function* (
  name: Name,
  layer: Layer.Layer<SqlClient.SqlClient, SqlError.SqlError>,
) {
  const side = name.startsWith("sqlite") ? "device" : "server";
  const context = yield* Layer.build(layer);

  const sql = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
    Effect.provide(effect, context);

  yield* sql(
    side === "device"
      ? DeviceDatabase.migrate(ProbeMigrations.migrations)
      : Effect.flatMap(SqlClient.SqlClient, (client) =>
          Effect.forEach(PostgresTx.schema, (statement) => client.unsafe(statement), {
            discard: true,
          }),
        ),
  ).pipe(Effect.orDie);
  const txLayer = side === "device" ? SqliteTx.layer : PostgresTx.layer;

  return {
    name,
    side,
    sql,
    transaction: (effect) =>
      sql(
        Effect.flatMap(SqlClient.SqlClient, (client) =>
          client.withTransaction(Effect.provide(effect, txLayer)),
        ),
      ),
  } satisfies Engine;
});

/** A fresh database on the run's PostgreSQL 18, so test files running in parallel stay apart. */
export const postgres18Database = (socket: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      // Names one throwaway database. Effect's Crypto service would have to reach every engine
      // layer for it.
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid-in-effect -- see above
      const database = `stu_${crypto.randomUUID().replaceAll("-", "")}`;

      const admin = yield* Layer.build(
        PgClient.layer({ host: socket, username: "postgres", database: "postgres" }),
      );

      yield* Effect.provide(
        Effect.flatMap(SqlClient.SqlClient, (sql) => sql.unsafe(`create database ${database}`)),
        admin,
      );

      return PgClient.layer({ host: socket, username: "postgres", database, maxConnections: 20 });
    }),
  );

const devices = [
  engine("sqlite-wasm", WasmSqliteClient.layerMemory({})),
  engine("sqlite-node", NodeSqliteClient.layer({ filename: ":memory:" })),
];

const servers = [
  engine("pglite", PgliteClient.layer({})),
  ...(postgres18 === null ? [] : [engine("postgres-18", postgres18Database(postgres18))]),
];

const layerOf = (engines: typeof devices) =>
  Layer.effect(
    Service,
    Effect.andThen(Effect.promise(installFileFetch), Effect.all(engines, { concurrency: 1 })),
  );

/** Every engine. */
export const layer = layerOf([...devices, ...servers]);

/** The device's two SQLite builds. */
export const deviceLayer = layerOf(devices);

// The shim is plain async Node code: it replaces the global fetch before Effect's wasm client starts.
/* oxlint-disable effecttsgo/async-function, effecttsgo/global-fetch, typescript/no-unsafe-type-assertion -- see above */
/**
 * wa-sqlite's web build loads its wasm with `fetch`, and Node's `fetch` rejects `file:` URLs, so
 * Effect's wasm client cannot start in Node as shipped. Remove this once `makeMemory` accepts the
 * wasm bytes or a `locateFile`, the same upstream change the app's OPFS worker needs.
 */
export async function installFileFetch() {
  const nodeFetch = globalThis.fetch;

  if ((nodeFetch as { readsFiles?: true }).readsFiles) return;

  const fileFetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);

    if (url.protocol !== "file:") return nodeFetch(input, init);

    return readFile(url).then(
      (bytes) => new Response(bytes, { headers: { "content-type": "application/wasm" } }),
    );
  };

  globalThis.fetch = Object.assign(fileFetch, { readsFiles: true as const });
}
/* oxlint-enable effecttsgo/async-function, effecttsgo/global-fetch, typescript/no-unsafe-type-assertion */
