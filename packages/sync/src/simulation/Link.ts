/**
 * An in-memory WebSocket between a simulated device and the simulated server. Both ends are
 * Effect's `Socket.fromWebSocket` over a fake WebSocket, so messages take production's JSON codecs,
 * serialization and socket adapter. The link delivers every frame once and in order, like TCP:
 * faults belong to `@stu/sync/lab`, except `sever`, which is the network going away.
 */
import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Socket from "effect/socket/Socket";

export * as Link from "./Link.ts";

/** `up` runs from the device to the server. */
export type Direction = "up" | "down";

/** What a connection ended with when the network dropped it, as browsers report it. */
export const abnormalClosure = 1006;

export interface Link {
  readonly device: Socket.Socket;
  readonly server: Socket.Socket;
  /** Drops the network: both ends see 1006 at once, and frames on their way are lost. */
  readonly sever: Effect.Effect<void>;
  /** The close code, once both ends are closed. */
  readonly closed: Effect.Effect<number>;
}

type Frame = Data.TaggedEnum<{
  Message: { readonly data: string | Uint8Array };
  Close: { readonly code: number; readonly reason: string | undefined };
}>;

const Frame = Data.taggedEnum<Frame>();

type EventType = "open" | "message" | "error" | "close";

type Listener = (event: Socket.WebSocketEvent) => void;

const connecting = 0;
const open = 1;
const closing = 2;
const closedState = 3;

interface End extends Socket.WebSocketLike {
  readyState: number;
  readonly dispatch: (type: EventType, event: Socket.WebSocketEvent) => void;
}

/**
 * A WebSocket that hands what it sends to `outgoing`. A message that arrives before anything
 * listens waits for the first listener, as a real socket's buffer keeps it. `onListen` runs when
 * the first message listener attaches.
 */
const fakeWebSocket = (
  readyState: typeof connecting | typeof open,
  outgoing: (frame: Frame) => void,
  onListen: () => void,
): End => {
  const listeners = new Map<EventType, Map<Listener, { readonly once: boolean }>>();
  const held: Array<Socket.WebSocketEvent> = [];

  const end: End = {
    readyState,

    addEventListener: (type, listener, options) => {
      const forType = listeners.get(type) ?? new Map<Listener, { readonly once: boolean }>();
      const first = type === "message" && forType.size === 0;
      forType.set(listener, { once: options?.once === true });
      listeners.set(type, forType);

      if (!first) return;

      for (const event of held.splice(0)) listener(event);
      onListen();
    },

    removeEventListener: (type, listener) => {
      listeners.get(type)?.delete(listener);
    },

    dispatch: (type, event) => {
      const forType = listeners.get(type);

      if (type === "message" && (forType === undefined || forType.size === 0)) {
        held.push(event);

        return;
      }

      for (const [listener, { once }] of forType ?? []) {
        if (once) forType?.delete(listener);
        listener(event);
      }
    },

    // A browser drops what is sent on a closing socket without an error.
    send: (data) => {
      if (end.readyState === open) outgoing(Frame.Message({ data }));
    },

    close: (code = 1000, reason) => {
      if (end.readyState >= closing) return;
      end.readyState = closing;
      outgoing(Frame.Close({ code, reason }));
    },
  };

  return end;
};

/**
 * A connected pair. `onFrame` sees every message as it reaches the other end, which is where the
 * simulation reads what the server received. The link closes when its scope does.
 */
export const make = Effect.fnUntraced(function* (
  onFrame: (direction: Direction, data: string | Uint8Array) => Effect.Effect<void>,
) {
  const up = yield* Queue.unbounded<Frame>();
  const down = yield* Queue.unbounded<Frame>();
  const closed = yield* Deferred.make<number>();
  let severed = false;

  // The device's socket opens once the server listens on its end, as an upgrade completes only
  // after the server accepted it.
  const device: End = fakeWebSocket(
    connecting,
    (frame) => Queue.offerUnsafe(up, frame),
    () => {},
  );

  const server: End = fakeWebSocket(
    open,
    (frame) => Queue.offerUnsafe(down, frame),
    () => {
      if (device.readyState !== connecting) return;
      device.readyState = open;
      device.dispatch("open", { type: "open" });
    },
  );

  const finish = (end: End, code: number, reason: string | undefined) => {
    end.readyState = closedState;
    end.dispatch("close", { type: "close", code, reason });
  };

  // The receiver answers a close frame with its own, and the sender's close event follows that,
  // as in the WebSocket closing handshake.
  const deliver = (direction: Direction, from: End, to: End) => (frame: Frame) =>
    Effect.suspend(() => {
      if (severed) return Effect.void;

      if (frame._tag === "Close") {
        if (to.readyState !== closedState) {
          finish(to, frame.code, frame.reason);
          finish(from, frame.code, frame.reason);
        }

        return Deferred.succeed(closed, frame.code);
      }

      if (to.readyState === closedState) return Effect.void;

      return Effect.andThen(
        onFrame(direction, frame.data),
        Effect.sync(() => to.dispatch("message", { type: "message", data: frame.data })),
      );
    });

  const run = (queue: Queue.Queue<Frame>, handle: (frame: Frame) => Effect.Effect<unknown>) =>
    Effect.forkScoped(Effect.forever(Effect.flatMap(Queue.take(queue), handle)));

  yield* run(up, deliver("up", device, server));
  yield* run(down, deliver("down", server, device));

  const sever = Effect.suspend(() => {
    if (severed || device.readyState === closedState) return Effect.void;
    severed = true;
    finish(device, abnormalClosure, undefined);
    finish(server, abnormalClosure, undefined);

    return Deferred.succeed(closed, abnormalClosure);
  });

  yield* Effect.addFinalizer(() => sever);

  const socketOf = (end: End) =>
    Socket.fromWebSocket(
      // Closing the reader's scope closes the socket, as releasing a real WebSocket does.
      Effect.acquireRelease(Effect.succeed(end), (ws) => Effect.sync(() => ws.close(1000))),
    );

  const link: Link = {
    device: yield* socketOf(device),
    server: yield* socketOf(server),
    sever,
    closed: Deferred.await(closed),
  };

  return link;
});
