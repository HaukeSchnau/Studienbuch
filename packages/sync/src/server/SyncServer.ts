/**
 * The server engine for one definition. `apps/server` provides it with Effect's `SqlClient` on
 * PostgreSQL 18, and the simulation on PGlite.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Headers from "effect/http/Headers";
import type * as Socket from "effect/socket/Socket";
import type { Sync } from "../definition/Sync.ts";
import { Connections } from "./Connections.ts";
import { Contract } from "./Contract.ts";
import { Events } from "./Events.ts";
import { Inspection } from "./Inspection.ts";
import type { Ports } from "./Ports.ts";
import { Pull } from "./Pull.ts";
import { Push } from "./Push.ts";
import { Revocations } from "./Revocations.ts";
import { Routes } from "./Routes.ts";
import { Spaces } from "./Spaces.ts";
import { SyncSchema } from "./SyncSchema.ts";
import { SyncWriter } from "./SyncWriter.ts";
import { Tickets } from "./Tickets.ts";

export * as SyncServer from "./SyncServer.ts";

export interface Options {
  /**
   * The oldest client the server serves. Raise `schema` in a release whose server needs clients
   * that read a replacement table, and older apps keep their data and wait for an update.
   */
  readonly minimum?: Contract.Minimum;
}

/** `Spaces` and `SyncWriter` alone, for server code that writes rows but serves no device. */
export const writers = (definition: Sync.Definition) =>
  Layer.mergeAll(Spaces.layer, SyncWriter.layer).pipe(
    Layer.provideMerge(SyncSchema.layer(definition)),
  );

/**
 * The whole engine: connections with push, pull and events, tickets, and `Spaces` and
 * `SyncWriter`. It takes Postgres's `SqlClient` and `LISTEN` (`Listener`), the sessions
 * (`Ports.SessionResolver`) and Effect's `Crypto` for tickets.
 */
export const layer = (definition: Sync.Definition, options?: Options) => {
  const minimum = options?.minimum ?? Contract.initialMinimum;

  return Layer.mergeAll(Connections.layer(minimum), Tickets.layer).pipe(
    Layer.provideMerge(
      Layer.mergeAll(Push.layer(minimum), Pull.layer(minimum), Events.layer, Revocations.layer),
    ),
    Layer.provideMerge(writers(definition)),
  );
};

/** The ticket route and the WebSocket at `Connection.socketPath`, for `HttpRouter.serve`. */
export const routes = Routes.layer;

/** `Sync.inspect` at `Inspect.path`, answering only when `answers` holds. */
export const inspection = Inspection.route;

/**
 * Serves one connection on `socket` until it closes, as the WebSocket route does after the
 * ticket check. The simulation calls it with an in-memory socket. With `headers`, the ones that
 * resolved the session, the connection asks `Ports.SessionResolver` again every few minutes.
 */
export const connection = (
  session: Ports.ResolvedSession,
  socket: Socket.Socket,
  headers?: Headers.Headers,
) =>
  Effect.flatMap(Connections.Service, (connections) => connections.serve(session, socket, headers));

/**
 * Closes the sync connections with 1012 when its scope closes. Built on the HTTP server, it runs
 * before the server drains its requests.
 */
export const closeFirst = Layer.effectDiscard(
  Effect.flatMap(Connections.Service, (connections) =>
    Effect.addFinalizer(() => connections.shutdown),
  ),
);
