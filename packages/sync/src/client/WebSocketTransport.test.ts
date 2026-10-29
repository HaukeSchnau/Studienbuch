import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Socket from "effect/socket/Socket";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { Connection } from "../protocol/Connection.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Ports } from "./Ports.ts";
import { Supervisor } from "./Supervisor.ts";
import { WebSocketTransport } from "./WebSocketTransport.ts";

interface FakeWebSocket extends Socket.WebSocketLike {
  readonly url: string;
  readonly sent: Array<string | Uint8Array>;
  /** The server closes the connection with `code`. */
  readonly closeFromServer: (code: number) => void;
}

/** A WebSocket that is open at once, records what it sends and never answers. */
const fakeWebSocket = (url: string): FakeWebSocket => {
  const listeners = new Map<string, Set<(event: Socket.WebSocketEvent) => void>>();
  let readyState = 1;

  const dispatch = (type: string, event: Socket.WebSocketEvent) => {
    for (const listener of listeners.get(type) ?? []) listener(event);
  };

  return {
    url,
    sent: [],
    get readyState() {
      return readyState;
    },
    addEventListener: (type, listener) => {
      const forType = listeners.get(type) ?? new Set();
      forType.add(listener);
      listeners.set(type, forType);
    },
    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },
    send(data) {
      this.sent.push(data);
    },
    close: () => {
      readyState = 3;
    },
    closeFromServer: (code) => {
      readyState = 3;
      dispatch("close", { code });
    },
  };
};

const sockets = () => {
  const opened: Array<FakeWebSocket> = [];

  const constructor = (url: string) => {
    const socket = fakeWebSocket(url);
    opened.push(socket);

    return socket;
  };

  return { opened, constructor };
};

const pull: Protocol.PullRequest = {
  clientId: "client-1",
  syncEpoch: null,
  contract: { protocol: 1, schema: 1, hash: "test" },
  cursors: [],
  settledMutationId: 0,
  limit: 10,
};

const connectTo = Effect.fnUntraced(function* (socket: Socket.Socket) {
  const connected = yield* WebSocketTransport.fromSocket(socket);

  const client = yield* RpcClient.make(Protocol.Rpcs).pipe(
    Effect.provideService(RpcClient.Protocol, connected.protocol),
  );

  return { connected, client };
});

describe("WebSocketTransport.fromSocket", () => {
  it.effect("a close code ends the connection and the call in flight, and nothing redials", () =>
    Effect.gen(function* () {
      const { opened, constructor } = sockets();

      const socket = yield* Socket.makeWebSocket("ws://server/api/sync?ticket=t").pipe(
        Effect.provideService(Socket.WebSocketConstructor, constructor),
      );

      const { connected, client } = yield* connectTo(socket);
      const call = yield* Effect.forkScoped(Effect.exit(client["Sync.pull"](pull)));
      yield* TestClock.adjust(0);

      expect(opened).toHaveLength(1);
      expect(opened[0]?.sent).toHaveLength(1);

      opened[0]?.closeFromServer(Connection.CloseCode.deviceRevoked);

      expect(yield* connected.closed).toBe(Connection.CloseCode.deviceRevoked);
      expect(Exit.isFailure(yield* Fiber.join(call))).toBe(true);

      yield* TestClock.adjust("1 minute");
      expect(opened).toHaveLength(1);
    }).pipe(Effect.scoped),
  );

  it.effect("a silent server ends the connection as 1006", () =>
    Effect.gen(function* () {
      const { opened, constructor } = sockets();

      const socket = yield* Socket.makeWebSocket("ws://server/api/sync?ticket=t").pipe(
        Effect.provideService(Socket.WebSocketConstructor, constructor),
      );

      const { connected } = yield* connectTo(socket);
      yield* TestClock.adjust("16 seconds");

      expect(yield* connected.closed).toBe(WebSocketTransport.abnormalClosure);
      expect(opened).toHaveLength(1);
    }).pipe(Effect.scoped),
  );
});

describe("Supervisor.overRpc", () => {
  it.effect("each connection numbers its requests from 0", () =>
    Effect.gen(function* () {
      const { opened, constructor } = sockets();

      for (let connection = 0; connection < 2; connection++) {
        const socket = yield* Socket.makeWebSocket("ws://server/api/sync?ticket=t").pipe(
          Effect.provideService(Socket.WebSocketConstructor, constructor),
        );

        const connected = yield* WebSocketTransport.fromSocket(socket);
        const { remote } = yield* Supervisor.overRpc(connected, pull.contract);
        yield* Effect.forkScoped(Effect.exit(remote.pull(pull)));
        yield* TestClock.adjust(0);
      }

      expect(opened.map((socket) => String(socket.sent[0]))).toEqual([
        expect.stringContaining('"id":0,'),
        expect.stringContaining('"id":0,'),
      ]);
    }).pipe(Effect.scoped),
  );
});

describe("WebSocketTransport.layer", () => {
  const transport = (status: number, body: string) => {
    const { opened, constructor } = sockets();
    const authorizations: Array<string | undefined> = [];

    const http = HttpClient.make((request) =>
      Effect.sync(() => {
        authorizations.push(request.headers.authorization);

        return HttpClientResponse.fromWeb(
          request,
          new Response(body, { status, headers: { "content-type": "application/json" } }),
        );
      }),
    );

    const layer = WebSocketTransport.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(Ports.Server, { origin: new URL("https://beta.example") }),
          Layer.succeed(Ports.Session, {
            accountId: "account-lena",
            token: Effect.succeedSome(Redacted.make("token-1")),
            changes: Stream.make(Option.some(Redacted.make("token-1"))),
            ended: Effect.void,
          }),
          Layer.succeed(HttpClient.HttpClient, http),
          Layer.succeed(Socket.WebSocketConstructor, constructor),
        ),
      ),
    );

    return { layer, opened, authorizations };
  };

  it.effect("a ticket opens the socket at its URL, with the session's bearer token", () =>
    Effect.gen(function* () {
      const { layer, opened, authorizations } = transport(200, '{"ticket":"t-1"}');

      yield* Effect.flatMap(Ports.Transport, (each) => each.connect).pipe(Effect.provide(layer));
      yield* TestClock.adjust(0);

      expect(authorizations).toEqual(["Bearer token-1"]);
      expect(opened.map((socket) => socket.url)).toEqual([
        "wss://beta.example/api/sync?ticket=t-1",
      ]);
    }).pipe(Effect.scoped),
  );

  it.effect("a ticket route that doesn't answer is unreachable after the timeout", () =>
    Effect.gen(function* () {
      const silent = HttpClient.make(() => Effect.never);

      const layer = WebSocketTransport.layer.pipe(
        Layer.provide(
          Layer.mergeAll(
            Layer.succeed(Ports.Server, { origin: new URL("https://beta.example") }),
            Layer.succeed(Ports.Session, {
              accountId: "account-lena",
              token: Effect.succeedSome(Redacted.make("token-1")),
              changes: Stream.make(Option.some(Redacted.make("token-1"))),
              ended: Effect.void,
            }),
            Layer.succeed(HttpClient.HttpClient, silent),
            Layer.succeed(Socket.WebSocketConstructor, sockets().constructor),
          ),
        ),
      );

      const attempt = yield* Effect.flatMap(Ports.Transport, (each) => each.connect).pipe(
        Effect.provide(layer),
        Effect.match({ onFailure: (error) => error.reason, onSuccess: () => "connected" }),
        Effect.forkScoped,
      );

      yield* TestClock.adjust(WebSocketTransport.ticketTimeout);
      expect(yield* Fiber.join(attempt)).toBe("unreachable");
    }).pipe(Effect.scoped),
  );

  it.effect("a 401 from the ticket route ends the session, any other failure is unreachable", () =>
    Effect.gen(function* () {
      const reason = (status: number) =>
        Effect.flatMap(Ports.Transport, (each) => each.connect).pipe(
          Effect.provide(transport(status, "{}").layer),
          Effect.match({ onFailure: (error) => error.reason, onSuccess: () => "connected" }),
          Effect.scoped,
        );

      expect(yield* reason(401)).toBe("session-ended");
      expect(yield* reason(503)).toBe("unreachable");
    }),
  );
});
