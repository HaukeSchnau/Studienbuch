/**
 * The engine's own `Transport`: a single-use ticket from the ticket route, then the WebSocket
 * with the ticket in its URL (`Connection`). `fromSocket` is the part the simulation and the Sync
 * Lab share with it: an open socket to `Protocol.Rpcs`, without Effect RPC's own reconnects.
 */
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Socket from "effect/socket/Socket";
import { Connection } from "../protocol/Connection.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Ports } from "./Ports.ts";

export * as WebSocketTransport from "./WebSocketTransport.ts";

/** What a connection ended with when no close frame came, as browsers report it. */
export const abnormalClosure = 1006;

/** Pings go out this often, and a connection silent for `pingTimeout` ends as 1006. */
export const pingInterval = "5 seconds";

export const pingTimeout = "10 seconds";

const closeCode = (error: Socket.SocketError) =>
  error.reason._tag === "SocketCloseError" ? error.reason.code : abnormalClosure;

/**
 * The client's end of one connection over `socket`, which its scope closes. `closed` completes
 * with the socket's close code, before the calls in flight fail. Nothing here reconnects: the
 * supervisor does.
 */
export const fromSocket = Effect.fnUntraced(function* (socket: Socket.Socket) {
  const closed = yield* Deferred.make<number>();
  const end = (code: number) => Effect.asVoid(Deferred.succeed(closed, code));
  const ended = (error: Socket.SocketError) => end(closeCode(error));

  const watched = Socket.make({
    reader: socket.reader.pipe(
      Effect.map((reader) => ({ ...reader, pull: Effect.tapError(reader.pull, ended) })),
      Effect.tapError(ended),
    ),
    writer: socket.writer,
  });

  const protocol = yield* RpcClient.makeProtocolSocket({
    retryTransientErrors: false,
    retryPolicy: Schedule.recurs(0),
    pingInterval,
    pingTimeout,
    onPingTimeout: end(abnormalClosure),
  }).pipe(
    Effect.provideService(Socket.Socket, watched),
    Effect.provideService(RpcClient.ConnectionHooks, {
      onConnect: Effect.void,
      onDisconnect: end(abnormalClosure),
    }),
    Effect.provide(Protocol.serialization),
  );

  return { protocol, closed: Deferred.await(closed) } satisfies Ports.Connected;
});

const decodeTicket = Schema.decodeUnknownEffect(Connection.Ticket);

/** How long the ticket route may take before the attempt counts as `unreachable`. */
export const ticketTimeout = "15 seconds";

/** Fetches a ticket with the session's bearer token and opens the socket with it. */
export const layer = Layer.effect(
  Ports.Transport,
  Effect.gen(function* () {
    const server = yield* Ports.Server;
    const session = yield* Ports.Session;
    const http = yield* HttpClient.HttpClient;
    const webSocket = yield* Socket.WebSocketConstructor;

    const unreachable = () => new Ports.ConnectFailed({ reason: "unreachable" });
    const sessionEnded = () => new Ports.ConnectFailed({ reason: "session-ended" });

    const ticket = Effect.gen(function* () {
      const token = yield* session.token;

      if (Option.isNone(token)) return yield* sessionEnded();

      const response = yield* http
        .execute(
          HttpClientRequest.post(new URL(Connection.ticketPath, server.origin)).pipe(
            HttpClientRequest.bearerToken(token.value),
          ),
        )
        .pipe(Effect.catchTags({ HttpClientError: () => Effect.fail(unreachable()) }));

      if (response.status === 401) return yield* sessionEnded();

      if (response.status !== 200) return yield* unreachable();

      const body = yield* Effect.flatMap(response.json, decodeTicket).pipe(
        Effect.catchTags({
          HttpClientError: () => Effect.fail(unreachable()),
          SchemaError: () => Effect.fail(unreachable()),
        }),
      );

      return body.ticket;
    });

    // A ticket route that never answers would hold the supervisor's attempt forever.
    const timelyTicket = Effect.timeoutOption(ticket, ticketTimeout).pipe(
      Effect.flatMap(Effect.fromOption),
      Effect.catchTags({ NoSuchElementError: () => Effect.fail(unreachable()) }),
    );

    return Ports.Transport.of({
      connect: Effect.gen(function* () {
        const url = Connection.socketUrl(server.origin, yield* timelyTicket);

        const socket = yield* Socket.makeWebSocket(url.href, { openTimeout: "15 seconds" }).pipe(
          Effect.provideService(Socket.WebSocketConstructor, webSocket),
        );

        return yield* fromSocket(socket);
      }),
    });
  }),
);
