/**
 * The sync engine in the server process: Studienbuch's definition over the server's Postgres,
 * pokes through a `LISTEN` connection of their own, and the routes at `/api/sync`. Its sessions
 * come from `Auth.layer`, the `Ports.SessionResolver` over Better Auth.
 */
import * as PgClient from "@effect/sql-pg/PgClient";
import { Studienbuch } from "@stu/core";
import { Listener, SyncServer } from "@stu/sync/server";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Deployment } from "../infra/config/Deployment.ts";

export * as Sync from "./Sync.ts";

/** Only development and preview servers show the Sync Lab what they hold. */
const inspection = Layer.unwrap(
  Effect.map(Deployment.Current, ({ environment }) =>
    SyncServer.inspection(environment === "development" || environment === "preview"),
  ),
);

export const layer = Layer.merge(SyncServer.routes, inspection).pipe(
  Layer.provideMerge(SyncServer.layer(Studienbuch.schema)),
  Layer.provide(Listener.layer(PgClient.PgClient, (notification) => notification.payload)),
);
