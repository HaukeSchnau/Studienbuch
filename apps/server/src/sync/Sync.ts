/**
 * The sync engine in the server process: Studienbuch's definition over the server's Postgres,
 * pokes through a `LISTEN` connection of their own, and the routes at `/api/sync`. Its sessions
 * come from `Auth.layer`, the `Ports.SessionResolver` over Better Auth.
 */
import * as PgClient from "@effect/sql-pg/PgClient";
import { Studienbuch } from "@stu/core";
import { Listener, SyncServer } from "@stu/sync/server";
import * as Layer from "effect/Layer";

export * as Sync from "./Sync.ts";

export const layer = SyncServer.routes.pipe(
  Layer.provideMerge(SyncServer.layer(Studienbuch.schema)),
  Layer.provide(Listener.layer(PgClient.PgClient, (notification) => notification.payload)),
);
