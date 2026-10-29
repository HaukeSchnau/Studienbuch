/**
 * One sync connection: an RPC server for `Protocol.Rpcs` on one socket, with the session's account
 * closed over. It closes with `Connection.CloseCode` when its session ends or its client is too
 * old, with 1000 at the session's term, 1012 on shutdown and 1008 past `perSession`.
 */
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as NetAddress from "effect/net/NetAddress";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import * as RpcServer from "effect/rpc/RpcServer";
import type * as Scope from "effect/Scope";
import * as Semaphore from "effect/Semaphore";
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
import { Revocations } from "./Revocations.ts";

export * as Connections from "./Connections.ts";

/** WebSocket close codes from RFC 6455, which a device answers by reconnecting. */
const normalClosure = 1000;

const serviceRestart = 1012;

const policyViolation = 1008;

/** Open connections per session at most. A new one closes the oldest, which its device dropped. */
export const perSession = 4;

/**
 * How often a connection asks `SessionResolver` again whether its session holds, between 4 and 6
 * minutes, because the revocation stream misses deletes in SQL and other server processes.
 */
const recheck = { least: Duration.minutes(4), most: Duration.minutes(6) };

/** How long a shutdown waits for its connections to close before the server drains. */
const shutdownGrace = Duration.seconds(2);

export class Service extends Context.Service<
  Service,
  {
    /**
     * Serves `Protocol.Rpcs` on `socket` for `session` until the socket closes. With `headers`,
     * the request headers that resolved the session, the connection checks them again on a timer.
     */
    readonly serve: (
      session: Ports.ResolvedSession,
      socket: Socket.Socket,
      headers?: Headers.Headers,
    ) => Effect.Effect<void, never, Scope.Scope>;
    /**
     * Closes every connection with 1012 and turns new ones away, waiting a moment for their
     * sockets to end. The layer does this as it closes. A server runs it before it drains HTTP,
     * which would otherwise wait out its timeout on the open sockets.
     */
    readonly shutdown: Effect.Effect<void>;
  }
>()("@stu/sync/server/Connections") {}

export const make = Effect.fn("Connections.make")(function* (minimum: Contract.Minimum) {
  const push = yield* Push.Service;
  const pull = yield* Pull.Service;
  const events = yield* Events.Service;
  const resolver = yield* Ports.SessionResolver;
  const revocations = yield* Revocations.Service;

  /** The open connections in the order they opened: whose, how to close each, when it ended. */
  const open = new Set<{
    readonly sessionId: string;
    readonly close: (code: number) => Effect.Effect<void>;
    readonly ended: Deferred.Deferred<void>;
  }>();

  /**
   * One push or pull at a time per session, shared by its connections, so a session's sockets
   * take one pool connection between them whatever client ids they push for.
   */
  const turns = new Map<string, { readonly semaphore: Semaphore.Semaphore; holders: number }>();

  const turnOf = (sessionId: string) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const turn = turns.get(sessionId) ?? { semaphore: Semaphore.makeUnsafe(1), holders: 0 };
        turn.holders += 1;
        turns.set(sessionId, turn);

        return turn.semaphore;
      }),
      () =>
        Effect.sync(() => {
          const turn = turns.get(sessionId);

          if (turn === undefined) return;
          turn.holders -= 1;

          if (turn.holders === 0) turns.delete(sessionId);
        }),
    );

  let shuttingDown = false;

  const shutdown = Effect.gen(function* () {
    shuttingDown = true;
    const closing = [...open];
    yield* Effect.forEach(closing, ({ close }) => close(serviceRestart), { discard: true });

    yield* Effect.forEach(closing, ({ ended }) => Deferred.await(ended), {
      concurrency: "unbounded",
      discard: true,
    }).pipe(Effect.timeoutOption(shutdownGrace));
  });

  yield* Effect.addFinalizer(() => shutdown);

  /** Completes once `headers` no longer resolve to the session. */
  const lapsed = Effect.fn("Connections.lapsed")(
    function* (session: Ports.ResolvedSession, headers: Headers.Headers) {
      const delay = yield* Random.nextBetween(
        Duration.toMillis(recheck.least),
        Duration.toMillis(recheck.most),
      );

      yield* Effect.sleep(Duration.millis(delay));

      // A resolver that fails, such as Better Auth's rejected promise, leaves the question to
      // the next check rather than ending this one unseen.
      const current = yield* resolver.resolve(headers).pipe(
        Effect.catchCauseIf(
          (cause) => !Cause.hasInterruptsOnly(cause),
          (cause) =>
            Effect.as(
              Effect.logWarning("A connection couldn't check its session again", cause),
              Option.some(session),
            ),
        ),
      );

      return Option.isSome(current) && current.value.sessionId === session.sessionId;
    },
    Effect.repeat({ while: (holds) => holds }),
    Effect.asVoid,
  );

  const serve = Effect.fn("Connections.serve")(function* (
    session: Ports.ResolvedSession,
    socket: Socket.Socket,
    headers?: Headers.Headers,
  ) {
    const socketEnded = yield* Deferred.make<void>();
    const closing = yield* Deferred.make<number>();
    const turn = yield* turnOf(session.sessionId);
    /** Requests whose answer ends the connection, by request id, with the close code. */
    const closeAfter = new Map<string, number>();
    let subscribed = false;

    const close = (code: number) =>
      Effect.scoped(
        Effect.flatMap(socket.writer, (writer) => writer.write(new Socket.CloseEvent(code))),
      ).pipe(Effect.ignore);

    const entry = { sessionId: session.sessionId, close, ended: socketEnded };

    yield* Effect.acquireRelease(
      Effect.sync(() => open.add(entry)),
      () => Effect.sync(() => open.delete(entry)),
    );

    const held = [...open].filter((each) => each.sessionId === session.sessionId);

    yield* Effect.forEach(
      held.slice(0, Math.max(0, held.length - perSession)),
      (oldest) => oldest.close(policyViolation),
      { discard: true },
    );

    const oneSocket = SocketServer.SocketServer.of({
      address: NetAddress.unixPathAddress(Connection.socketPath),
      run: (handler) =>
        Effect.andThen(
          Effect.ensuring(Effect.orDie(handler(socket)), Deferred.succeed(socketEnded, undefined)),
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

    const answer = <A, E extends { readonly _tag: string }>(
      requestId: RpcMessage.RequestId,
      work: Effect.Effect<A, E>,
    ) =>
      turn
        .withPermits(1)(work)
        .pipe(
          Effect.tapError((error) =>
            Effect.sync(() => {
              if (error._tag === "Sync.UpdateRequired") {
                closeAfter.set(String(requestId), Connection.CloseCode.updateRequired);
              }
            }),
          ),
        );

    const handlers = Protocol.Rpcs.toLayer({
      "Sync.push": (request, { requestId }) =>
        answer(requestId, push.push(session.accountId, request)),
      "Sync.pull": (request, { requestId }) =>
        answer(requestId, pull.pull(session.accountId, request)),
      // An event stream has no error to answer with, so an old client hears only the close. A
      // device subscribes once per connection, and a second subscription ends at once.
      "Sync.events": ({ contract }) =>
        Stream.unwrap(
          Effect.gen(function* () {
            yield* Contract.admit(contract, minimum);

            if (subscribed) return Stream.empty;

            yield* Effect.acquireRelease(
              Effect.sync(() => {
                subscribed = true;
              }),
              () =>
                Effect.sync(() => {
                  subscribed = false;
                }),
            );

            return yield* events.subscribe(session.accountId, contract);
          }).pipe(
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

    const now = yield* Clock.currentTimeMillis;
    const term = Duration.millis(Math.max(0, DateTime.toEpochMillis(session.expiresAt) - now));

    yield* Effect.raceAll([
      Deferred.await(socketEnded),
      Effect.andThen(
        revocations.revocation(session.sessionId),
        close(Connection.CloseCode.sessionEnded),
      ),
      Effect.andThen(
        headers === undefined ? Effect.never : lapsed(session, headers),
        close(Connection.CloseCode.sessionEnded),
      ),
      Effect.flatMap(Deferred.await(closing), close),
      Effect.andThen(Effect.sleep(term), close(normalClosure)),
      shuttingDown ? close(serviceRestart) : Effect.never,
    ]).pipe(
      // A server that stops this fiber is going away: its devices come back soon.
      Effect.onInterrupt(() => close(serviceRestart)),
    );

    yield* Deferred.await(socketEnded);
  });

  return Service.of({ serve, shutdown });
});

export const layer = (minimum: Contract.Minimum) => Layer.effect(Service, make(minimum));
