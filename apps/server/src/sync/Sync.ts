/**
 * The sync engine in the server process: Studienbuch's definition over the server's Postgres,
 * pokes through a `LISTEN` connection of their own, and the routes at `/api/sync`. Its sessions
 * come from `Auth.layer`, the `Ports.SessionResolver` over Better Auth, and its key records from
 * the key store.
 */
import * as PgClient from "@effect/sql-pg/PgClient";
import { Studienbuch } from "@stu/core";
import { CryptoSuite } from "@stu/e2ee";
import { Listener, Ports, SyncServer } from "@stu/sync/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/sql/SqlClient";
import { Deployment } from "../infra/config/Deployment.ts";
import { KeyStore } from "../keys/KeyStore.ts";

export * as Sync from "./Sync.ts";

/** Only development and preview servers show the Sync Lab what they hold. */
const inspection = Layer.unwrap(
  Effect.map(Deployment.Current, ({ environment }) =>
    SyncServer.inspection(Deployment.isDevelopmentOrPreview(environment)),
  ),
);

/** The key records a `Seal`'s signatures are checked against, from the key store. */
export const accountKeys = Layer.effect(
  Ports.AccountKeys,
  Effect.map(SqlClient.SqlClient, (sql) =>
    Ports.AccountKeys.of({
      newest: (account) =>
        KeyStore.newest(account).pipe(Effect.provideService(SqlClient.SqlClient, sql)),
    }),
  ),
);

export const layer = Layer.merge(SyncServer.routes, inspection).pipe(
  Layer.provideMerge(SyncServer.layer(Studienbuch.schema)),
  Layer.provide(
    Layer.mergeAll(
      Listener.layer(PgClient.PgClient, (notification) => notification.payload),
      accountKeys,
      CryptoSuite.layer,
    ),
  ),
);
