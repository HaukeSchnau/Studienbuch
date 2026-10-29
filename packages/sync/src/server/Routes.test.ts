import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Socket from "effect/socket/Socket";
import { Command } from "../protocol/Command.ts";
import { Connection } from "../protocol/Connection.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Postgres18 } from "../testing/Postgres18.ts";
import { Fixture } from "./Fixture.ts";
import { SyncServer } from "./SyncServer.ts";

const decodeTicket = Schema.decodeUnknownEffect(Connection.Ticket);

const served = (options?: SyncServer.Options) =>
  HttpRouter.serve(SyncServer.routes, { disableLogger: true, disableListenLog: true }).pipe(
    Layer.provideMerge(NodeHttpServer.layerTest),
    Layer.provideMerge(Fixture.serverWith(options)),
  );

const sessionOf = (name: string) => ({
  accountId: `${name}-lena`,
  sessionId: `${name}-session`,
  expiresAt: DateTime.makeUnsafe(Date.UTC(2100, 0, 1)),
});

/** Posts for a ticket, as a device does with its bearer token. */
const ticket = (token: string | null) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const request = HttpClientRequest.post(Connection.ticketPath);

    const response = yield* client.execute(
      token === null ? request : HttpClientRequest.bearerToken(request, token),
    );

    if (response.status !== 200) return { status: response.status, ticket: null };

    return { status: 200, ticket: (yield* decodeTicket(yield* response.json)).ticket };
  });

/** A device's connection: the RPC client on the WebSocket, and the code the server closed with. */
const connect = (ticket: string) =>
  Effect.gen(function* () {
    const server = yield* HttpServer.HttpServer;
    const url = Connection.socketUrl(new URL(HttpServer.formatAddress(server.address)), ticket);
    const closed = yield* Deferred.make<number>();

    const socket = yield* Socket.fromWebSocket(
      Effect.acquireRelease(
        Effect.sync(() => {
          const webSocket = new globalThis.WebSocket(url);

          webSocket.addEventListener("close", (event) =>
            Deferred.doneUnsafe(closed, Exit.succeed(event.code)),
          );

          return webSocket;
        }),
        (webSocket) => Effect.sync(() => webSocket.close(1000)),
      ),
    );

    const protocol = yield* RpcClient.makeProtocolSocket({ retryTransientErrors: false }).pipe(
      Effect.provideService(Socket.Socket, socket),
      Effect.provide(Protocol.serialization),
    );

    const client = yield* RpcClient.make(Protocol.Rpcs).pipe(
      Effect.provideService(RpcClient.Protocol, protocol),
    );

    return { client, closed: Deferred.await(closed) };
  });

const pullRequest = (clientId: string, contract = Fixture.definition.contract) => ({
  clientId,
  syncEpoch: null,
  contract,
  cursors: [],
  settledMutationId: 0,
  limit: 100,
});

describe.skipIf(Postgres18.socket === null)("The sync routes on PostgreSQL 18", () => {
  // The real clock: a real WebSocket server and client talk here.
  layer(served(), { excludeTestServices: true })((it) => {
    it.effect("a ticket comes for a session only and opens one connection", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const sessions = yield* Fixture.Sessions;
          const session = sessionOf("tickets");
          yield* sessions.add(session);
          const anonymous = yield* ticket(null);
          const issued = yield* ticket(session.sessionId);
          const { client } = yield* connect(issued.ticket ?? "");
          const pulled = yield* client["Sync.pull"](pullRequest("tickets-device"));

          const pushed = yield* client["Sync.push"]({
            clientId: "tickets-device",
            syncEpoch: pulled.syncEpoch,
            contract: Fixture.definition.contract,
            commands: [
              Command.Seal.make({
                mutationId: 1,
                at: DateTime.makeUnsafe(0),
                writes: [],
                boxes: [],
                links: [],
              }),
            ],
          });

          const again = yield* HttpClient.get(
            `${Connection.socketPath}?ticket=${issued.ticket ?? ""}`,
          );

          expect([anonymous.status, issued.status, pushed.lastMutationId, again.status]).toEqual([
            401, 200, 1, 401,
          ]);
        }),
      ),
    );

    it.effect("a revoked session's connection closes with the code for an ended session", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const sessions = yield* Fixture.Sessions;
          const session = sessionOf("revoked");
          yield* sessions.add(session);

          const { client, closed } = yield* connect(
            (yield* ticket(session.sessionId)).ticket ?? "",
          );

          yield* client["Sync.pull"](pullRequest("revoked-device"));
          yield* sessions.revoke(session.sessionId);

          expect(yield* closed).toBe(Connection.CloseCode.sessionEnded);
        }),
      ),
    );
  });

  it.live("a server shutting down closes its connections with 1012 before it drains HTTP", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const scope = yield* Scope.make();

        const server = yield* Layer.buildWithScope(
          SyncServer.closeFirst.pipe(Layer.provideMerge(served())),
          scope,
        );

        yield* Effect.provide(
          Effect.gen(function* () {
            const sessions = yield* Fixture.Sessions;
            const session = sessionOf("shutdown");
            yield* sessions.add(session);
            const issued = yield* ticket(session.sessionId);
            const { client, closed } = yield* connect(issued.ticket ?? "");
            yield* client["Sync.pull"](pullRequest("shutdown-device"));
            const shutdown = yield* Effect.forkChild(Scope.close(scope, Exit.void));

            // The HTTP server alone would hold the socket open for its 20 second drain.
            expect(yield* Effect.timeoutOption(closed, "5 seconds")).toEqual(Option.some(1012));
            yield* Fiber.join(shutdown);
          }),
          server,
        );
      }),
    ),
  );

  layer(served({ minimum: { protocol: 1, schema: 2 } }), { excludeTestServices: true })((it) => {
    it.effect("a client below the minimum gets UpdateRequired, then the update close code", () =>
      Effect.scoped(
        Effect.gen(function* () {
          const sessions = yield* Fixture.Sessions;
          const session = sessionOf("outdated");
          yield* sessions.add(session);

          const { client, closed } = yield* connect(
            (yield* ticket(session.sessionId)).ticket ?? "",
          );

          const error = yield* Effect.flip(client["Sync.pull"](pullRequest("outdated-device")));

          expect([error, yield* closed]).toEqual([
            new Protocol.UpdateRequired({ minimum: { protocol: 1, schema: 2 } }),
            Connection.CloseCode.updateRequired,
          ]);
        }),
      ),
    );
  });
});
