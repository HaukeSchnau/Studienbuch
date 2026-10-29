/**
 * One sync connection: an RPC server for `Protocol.Rpcs` on one socket, with the session's account
 * closed over, so the session is checked once per connection rather than per message. The
 * connection ends with `Connection.CloseCode` when its session is revoked or its client is too
 * old, and normally when the session's term ends, so the ticket route decides whether it goes on.
 */
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcServer from "effect/rpc/RpcServer";
import type * as Scope from "effect/Scope";
import * as Socket from "effect/socket/Socket";
import * as SocketServer from "effect/socket/SocketServer";
import * as Stream from "effect/Stream";
import { Connection } from "../protocol/Connection.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Contract } from "./Contract.ts";
import { Events } from "./Events.ts";
import { Ports } from "./Ports.ts";
import { Pull } from "./Pull.ts";
import { Push } from "./Push.ts";

export * as Connections from "./Connections.ts";

/** WebSocket close codes from RFC 6455, which a device answers by reconnecting. */
const normalClosure = 1000;

const serviceRestart = 1012;

export class Service extends Context.Service<
  Service,
  {
    /** Serves `Protocol.Rpcs` on `socket` for `session` until the socket closes. */
    readonly serve: (
      session: Ports.ResolvedSession,
      socket: Socket.Socket,
    ) => Effect.Effect<void, never, Scope.Scope>;
  }
>()("@stu/sync/server/Connections") {}

export const make = Effect.fn("Connections.make")(function* (minimum: Contract.Minimum) {
  const push = yield* Push.Service;
  const pull = yield* Pull.Service;
  const events = yield* Events.Service;
  const resolver = yield* Ports.SessionResolver;
  const revocations = new Map<string, Set<Deferred.Deferred<void>>>();

  // One reader for the whole process, which tells each connection of a revoked session.
  yield* Stream.runForEach(resolver.revoked, (session) =>
    Effect.forEach(revocations.get(session) ?? [], (revoked) =>
      Deferred.succeed(revoked, undefined),
    ),
  ).pipe(Effect.forkScoped);

  const revoked = (session: string) =>
    Effect.acquireRelease(
      Effect.map(Deferred.make<void>(), (deferred) => {
        const connections = revocations.get(session) ?? new Set();
        connections.add(deferred);
        revocations.set(session, connections);

        return deferred;
      }),
      (deferred) =>
        Effect.sync(() => {
          const connections = revocations.get(session);
          connections?.delete(deferred);

          if (connections?.size === 0) revocations.delete(session);
        }),
    );

  const serve = Effect.fn("Connections.serve")(function* (
    session: Ports.ResolvedSession,
    socket: Socket.Socket,
  ) {
    const ended = yield* Deferred.make<void>();
    const closing = yield* Deferred.make<number>();
    const revocation = yield* revoked(session.sessionId);
    /** Requests whose answer ends the connection, by request id, with the close code. */
    const closeAfter = new Map<string, number>();

    const oneSocket = SocketServer.SocketServer.of({
      address: NetAddress.unixPathAddress(Connection.socketPath),
      run: (handler) =>
        Effect.andThen(
          Effect.ensuring(Effect.orDie(handler(socket)), Deferred.succeed(ended, undefined)),
          Effect.never,
        ),
    });

    const server = yield* RpcServer.makeProtocolSocketServer.pipe(
      Effect.provideService(SocketServer.SocketServer, oneSocket),
      Effect.provide(Protocol.serialization),
    );

    // The close frame follows the error it explains, so a device that reads one has the other.
    const protocol = RpcServer.Protocol.of({
      ...server,
      send: (client, response, transferables) =>
        Effect.andThen(server.send(client, response, transferables), () => {
          const code =
            response._tag === "Exit" ? closeAfter.get(String(response.requestId)) : undefined;

          return code === undefined ? Effect.void : Deferred.succeed(closing, code);
        }),
    });

    const closesAfter = <A, E extends { readonly _tag: string }>(
      requestId: RpcMessage.RequestId,
      answer: Effect.Effect<A, E>,
    ) =>
      Effect.tapError(answer, (error) =>
        Effect.sync(() => {
          if (error._tag === "Sync.UpdateRequired") {
            closeAfter.set(String(requestId), Connection.CloseCode.updateRequired);
          }
        }),
      );

    const handlers = Protocol.Rpcs.toLayer({
      "Sync.push": (request, { requestId }) =>
        closesAfter(requestId, push.push(session.accountId, request)),
      "Sync.pull": (request, { requestId }) =>
        closesAfter(requestId, pull.pull(session.accountId, request)),
      // An event stream has no error to answer with, so an old client hears only the close.
      "Sync.events": ({ contract }) =>
        Stream.unwrap(
          Contract.admit(contract, minimum).pipe(
            Effect.andThen(events.subscribe(session.accountId, contract)),
            Effect.catchTags({
              "Sync.UpdateRequired": () =>
                Effect.as(
                  Deferred.succeed(closing, Connection.CloseCode.updateRequired),
                  Stream.empty,
                ),
            }),
          ),
        ),
    });

    yield* RpcServer.make(Protocol.Rpcs, { disableFatalDefects: true }).pipe(
      Effect.provideService(RpcServer.Protocol, protocol),
      Effect.provide(handlers),
      Effect.forkScoped,
    );

    const close = (code: number) =>
      Effect.scoped(
        Effect.flatMap(socket.writer, (writer) => writer.write(new Socket.CloseEvent(code))),
      ).pipe(Effect.ignore);

    const now = yield* Clock.currentTimeMillis;
    const term = Duration.millis(Math.max(0, DateTime.toEpochMillis(session.expiresAt) - now));

    yield* Effect.raceAll([
      Deferred.await(ended),
      Effect.andThen(Deferred.await(revocation), close(Connection.CloseCode.sessionEnded)),
      Effect.flatMap(Deferred.await(closing), close),
      Effect.andThen(Effect.sleep(term), close(normalClosure)),
    ]).pipe(
      // A shutting-down server tells its devices to come back soon.
      Effect.onInterrupt(() => close(serviceRestart)),
    );

    yield* Deferred.await(ended);
  });

  return Service.of({ serve });
});

export const layer = (minimum: Contract.Minimum) => Layer.effect(Service, make(minimum));
