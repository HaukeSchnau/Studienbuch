/**
 * The simulated network. Each connection a device opens is a new `Link`, and the server end runs
 * `serve`, the server engine's entry for one WebSocket. Links live in the network's scope, so a
 * device that closes its connection closes its socket, and the server sees the close frame.
 */
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as NetAddress from "effect/net/NetAddress";
import type * as Rpc from "effect/rpc/Rpc";
import * as RpcClient from "effect/rpc/RpcClient";
import type * as RpcGroup from "effect/rpc/RpcGroup";
import * as RpcServer from "effect/rpc/RpcServer";
import * as Schedule from "effect/Schedule";
import type * as Scope from "effect/Scope";
import * as Socket from "effect/socket/Socket";
import * as SocketServer from "effect/socket/SocketServer";
import type { Ports } from "../client/Ports.ts";
import { Protocol } from "../protocol/Protocol.ts";
import type { Ports as ServerPorts } from "../server/Ports.ts";
import { Link } from "./Link.ts";

export * as Network from "./Network.ts";

/** One frame as it reached the other end. */
export interface Frame {
  readonly device: string;
  readonly direction: Link.Direction;
  readonly data: string | Uint8Array;
}

/** The server's side of one connection. It returns when the connection has ended. */
export type Serve = (
  session: ServerPorts.ResolvedSession,
  socket: Socket.Socket,
) => Effect.Effect<void, never, Scope.Scope>;

export interface Device {
  readonly id: string;
  readonly session: ServerPorts.ResolvedSession;
}

/**
 * The device's end of a socket as the engine sees it. Its own reconnects are off and pings match
 * the engine's, because the engine's supervisor owns retries (m1-plan, choice 4).
 */
const connected = Effect.fnUntraced(function* (
  socket: Socket.Socket,
  closed: Effect.Effect<number>,
) {
  const protocol = yield* RpcClient.makeProtocolSocket({
    retryPolicy: Schedule.recurs(0),
    pingInterval: "5 seconds",
    pingTimeout: "10 seconds",
  }).pipe(Effect.provideService(Socket.Socket, socket), Effect.provide(Protocol.serialization));

  return { protocol, closed } satisfies Ports.Connected;
});

export const make = Effect.fnUntraced(function* (
  serve: Serve,
  observe: (frame: Frame) => Effect.Effect<void>,
) {
  const scope = yield* Effect.scope;
  const open = new Map<string, Set<Link>>();

  const opened = (device: string) => {
    const links = open.get(device) ?? new Set<Link>();
    open.set(device, links);

    return links;
  };

  /** The link of one connection and the server's handling of it, which outlive the device's end. */
  const accept = (device: Device, ready: Deferred.Deferred<Link>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const link = yield* Link.make((direction, data) =>
          observe({ device: device.id, direction, data }),
        );

        const links = opened(device.id);

        links.add(link);
        yield* Effect.addFinalizer(() => Effect.sync(() => links.delete(link)));
        yield* Deferred.succeed(ready, link);
        yield* serve(device.session, link.server);
        yield* link.closed;
      }),
    ).pipe(Effect.forkIn(scope));

  return {
    /** A device's transport, before faults. */
    transport: (device: Device): Ports.Transport["Service"] => ({
      connect: Effect.gen(function* () {
        const ready = yield* Deferred.make<Link>();

        yield* accept(device, ready);
        const link = yield* Deferred.await(ready);

        return yield* connected(link.device, link.closed);
      }),
    }),

    /** Drops every open connection of a device at once, as when its network goes away. */
    sever: (device: string) =>
      Effect.forEach([...opened(device)], (link) => link.sever, { discard: true }),

    /** How many connections of a device are open. */
    connections: (device: string) => Effect.sync(() => opened(device).size),
  };
});

export type Network = Effect.Success<ReturnType<typeof make>>;

/**
 * Runs an RPC group's handlers on one socket until it closes, through Effect's socket server
 * protocol, the framing the WebSocket route uses too. The harness's own tests serve stubs with it.
 */
export const serveSocket = Effect.fnUntraced(function* <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  socket: Socket.Socket,
) {
  const ended = yield* Deferred.make<void>();

  const oneSocket = SocketServer.SocketServer.of({
    address: NetAddress.unixPathAddress("simulation"),
    run: (handler) =>
      Effect.andThen(
        Effect.ensuring(Effect.orDie(handler(socket)), Deferred.succeed(ended, undefined)),
        Effect.never,
      ),
  });

  const protocol = yield* RpcServer.makeProtocolSocketServer.pipe(
    Effect.provideService(SocketServer.SocketServer, oneSocket),
    Effect.provide(Protocol.serialization),
  );

  yield* RpcServer.make(group, { disableFatalDefects: true }).pipe(
    Effect.provideService(RpcServer.Protocol, protocol),
    Effect.forkScoped,
  );
  yield* Deferred.await(ended);
});
