/**
 * Faults on one device's connection: the Sync Lab's controls and the simulation's. `transport`
 * wraps the device's own `Transport` (a preview's WebSocket, or the simulation's in-memory link),
 * so a fault found by hand replays as a seeded test. Messages keep their order in each direction,
 * as on one WebSocket, and every fault but `latency` and `offline` fires once.
 *
 * ```ts
 * const faults = yield* Faults.make
 * const transport = faults.transport(engineTransport)
 * yield* faults.arm("dropNextResponse")
 * ```
 */
import * as Clock from "effect/Clock";
import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Queue from "effect/Queue";
import type * as RpcClient from "effect/rpc/RpcClient";
import * as RpcClientError from "effect/rpc/RpcClientError";
import type * as RpcMessage from "effect/rpc/RpcMessage";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Socket from "effect/socket/Socket";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Ports } from "../client/Ports.ts";
import { Protocol } from "../protocol/Protocol.ts";

export * as Faults from "./Faults.ts";

/**
 * A command the device never made, the way a modified app sends it, which the server must refuse.
 * `SealInto` sends the next `Seal`'s writes to `space`, such as another student's notebook.
 * `RewriteArgs` gives the next `Mutate` of `mutator` the arguments `args`, and the mutator name
 * `name` when given, such as one the server doesn't know.
 */
export type Forge = Data.TaggedEnum<{
  SealInto: { readonly space: string };
  RewriteArgs: {
    readonly mutator: string;
    readonly args: Schema.Json;
    readonly name?: string | undefined;
  };
}>;

export const Forge = Data.taggedEnum<Forge>();

/** The faults that fire once. */
export type OneShot = "dropNextResponse" | "duplicateNextPush" | "reorderNext";

export interface Settings {
  /** No connection opens, and the open ones drop. */
  readonly offline: boolean;
  /** How long each message travels, in both directions. */
  readonly latency: Duration.Duration;
  /**
   * The next push or pull response is lost and the connection drops, as when the network goes
   * away after the server committed.
   */
  readonly dropNextResponse: boolean;
  /** The next push reaches the server a second time, on a connection of its own. */
  readonly duplicateNextPush: boolean;
  /** The next response or event arrives after the one behind it. */
  readonly reorderNext: boolean;
  readonly forge: Option.Option<Forge>;
}

export const initial: Settings = {
  offline: false,
  latency: Duration.zero,
  dropNextResponse: false,
  duplicateNextPush: false,
  reorderNext: false,
  forge: Option.none(),
};

/** What happened, for the lab's log and the simulation's trace. */
export interface Event {
  readonly fault: OneShot | "offline" | "online" | "latency" | "disconnect" | "forge";
  /** By the device's `Clock`. */
  readonly at: number;
  readonly detail: string;
}

/** How long a held response waits for one to overtake it before it goes out anyway. */
export const reorderWindow = Duration.seconds(1);

/** What the engine sees when a fault drops its connection, like a lost network. */
export const droppedCode = 1006;

/** What every call in flight on a dropped connection fails with, as a closed socket fails them. */
export const dropped = new RpcClientError.RpcClientError({
  reason: new Socket.SocketCloseError({ code: droppedCode }),
});

const encodeForge = Schema.encodeEffect(Schema.fromJsonString(Schema.Json));

const PushJson = Schema.toCodecJson(Protocol.PushRequest);

const decodePush = Schema.decodeUnknownEffect(PushJson);

const encodePush = Schema.encodeEffect(PushJson);

export const make = Effect.gen(function* () {
  const settings = yield* SubscriptionRef.make(initial);
  const events = yield* PubSub.unbounded<Event>();
  const drops = new Set<Effect.Effect<void>>();
  // Duplicated pushes outlive the connection they were copied from.
  const scope = yield* Effect.scope;

  const emit = (fault: Event["fault"], detail: string) =>
    Effect.flatMap(Clock.currentTimeMillis, (at) => PubSub.publish(events, { fault, at, detail }));

  const dropAll = Effect.suspend(() => Effect.all([...drops], { discard: true }));

  /** Disarms a one-shot fault and says whether it was armed. */
  const take = (fault: OneShot) =>
    SubscriptionRef.modify(settings, (current) => [current[fault], { ...current, [fault]: false }]);

  const takeForge = (matches: (forge: Forge) => boolean) =>
    SubscriptionRef.modify(settings, (current) =>
      Option.isSome(current.forge) && matches(current.forge.value)
        ? [current.forge, { ...current, forge: Option.none() }]
        : [Option.none<Forge>(), current],
    );

  const forgePush = Effect.fnUntraced(function* (request: RpcMessage.RequestEncoded) {
    if (Option.isNone((yield* SubscriptionRef.get(settings)).forge)) return request;
    const push = yield* decodePush(request.payload).pipe(Effect.orDie);

    const target = (forge: Forge) =>
      push.commands.findIndex((command) =>
        forge._tag === "SealInto"
          ? command._tag === "Seal" && command.writes.length > 0
          : command._tag === "Mutate" && command.name === forge.mutator,
      );

    const forge = yield* takeForge((candidate) => target(candidate) !== -1);

    if (Option.isNone(forge)) return request;
    const index = target(forge.value);

    const commands = push.commands.map((command, at) => {
      if (at !== index) return command;

      if (forge.value._tag === "SealInto" && command._tag === "Seal") {
        const space = forge.value.space;

        return { ...command, writes: command.writes.map((write) => ({ ...write, space })) };
      }

      if (forge.value._tag === "RewriteArgs" && command._tag === "Mutate") {
        return { ...command, name: forge.value.name ?? command.name, args: forge.value.args };
      }

      return command;
    });

    const detail =
      forge.value._tag === "SealInto"
        ? `SealInto ${forge.value.space}`
        : `RewriteArgs ${forge.value.mutator}${forge.value.name === undefined ? "" : ` as ${forge.value.name}`} ${yield* Effect.orDie(encodeForge(forge.value.args))}`;

    yield* emit("forge", `${detail} on mutation ${commands[index]?.mutationId ?? ""}`);

    return { ...request, payload: yield* encodePush({ ...push, commands }).pipe(Effect.orDie) };
  });

  /**
   * Sends a copy of a push on a connection of its own and waits for its answer, which it drops.
   * Going offline or a disconnect drops that connection too.
   */
  const duplicate = (inner: Ports.Transport["Service"], request: RpcMessage.RequestEncoded) =>
    Effect.scoped(
      Effect.gen(function* () {
        const side = yield* inner.connect;
        const answered = yield* Deferred.make<void>();
        const drop = Deferred.succeed(answered, undefined).pipe(Effect.asVoid);

        drops.add(drop);
        yield* Effect.addFinalizer(() => Effect.sync(() => drops.delete(drop)));

        yield* Effect.forkScoped(
          side.protocol.run(0, (message) =>
            message._tag === "Exit" && message.requestId === request.id ? drop : Effect.void,
          ),
        );
        yield* side.protocol.send(0, request);
        yield* Effect.raceFirst(Deferred.await(answered), side.closed);
      }),
    ).pipe(Effect.ignore, Effect.forkIn(scope));

  const transport = (inner: Ports.Transport["Service"]): Ports.Transport["Service"] => ({
    connect: Effect.gen(function* () {
      if ((yield* SubscriptionRef.get(settings)).offline) {
        return yield* new Ports.ConnectFailed({ reason: "unreachable" });
      }

      const outer = yield* Effect.scope;
      const own = yield* Scope.fork(outer);
      const connected = yield* inner.connect.pipe(Scope.provide(own));
      const closedBy = yield* Deferred.make<number>();
      let isDropped = false;

      // The tags of requests in flight, so a fault can tell a push's answer from an event.
      const tags = new Map<string | number, string>();

      const handlers = new Map<
        number,
        (message: RpcMessage.FromServerEncoded) => Effect.Effect<void>
      >();

      // Every call in flight fails as on a closed socket, and so does every later send.
      const failed: RpcMessage.FromServerEncoded = {
        // Effect has no constructor for this protocol message. It is what `makeProtocolSocket`
        // hands every handler when its socket closes.
        // oxlint-disable-next-line anti-slop-effect/no-manual-tagged-construction -- see above
        _tag: "ClientProtocolError",
        error: dropped,
      };

      const drop = Effect.suspend(() => {
        if (isDropped) return Effect.void;
        isDropped = true;
        tags.clear();

        return Effect.forEach([...handlers.values()], (handler) => handler(failed), {
          discard: true,
        }).pipe(
          Effect.andThen(Deferred.succeed(closedBy, droppedCode)),
          Effect.andThen(Scope.close(own, Exit.void)),
        );
      });

      drops.add(drop);
      yield* Scope.addFinalizer(
        outer,
        Effect.sync(() => drops.delete(drop)),
      );

      type Message<A> = { readonly clientId: number; readonly message: A; readonly due: number };

      const up = yield* Queue.unbounded<Message<RpcMessage.FromClientEncoded>>();
      const down = yield* Queue.unbounded<Message<RpcMessage.FromServerEncoded>>();

      // Runs for every message, so it carries no span.
      const stamp = Effect.fnUntraced(function* <A>(
        queue: Queue.Queue<Message<A>>,
        clientId: number,
        message: A,
      ) {
        const { latency } = yield* SubscriptionRef.get(settings);
        const now = yield* Clock.currentTimeMillis;

        yield* Queue.offer(queue, { clientId, message, due: now + Duration.toMillis(latency) });
      });

      const arrive = (due: number) =>
        Effect.flatMap(Clock.currentTimeMillis, (now) =>
          due > now ? Effect.sleep(Duration.millis(due - now)) : Effect.void,
        );

      const send = Effect.fnUntraced(function* ({
        clientId,
        message,
      }: Message<RpcMessage.FromClientEncoded>) {
        // A message queued before a drop never leaves, so it neither forges nor duplicates.
        if (isDropped) return;
        let outgoing = message;

        if (outgoing._tag === "Request") {
          tags.set(outgoing.id, outgoing.tag);

          if (outgoing.tag === "Sync.push") {
            outgoing = yield* forgePush(outgoing);

            if (yield* take("duplicateNextPush")) {
              yield* emit("duplicateNextPush", `request ${outgoing.id}`);
              yield* duplicate(inner, outgoing);
            }
          }
        }

        // A failed send means the connection broke, which `closed` reports.
        yield* connected.protocol.send(clientId, outgoing).pipe(Effect.ignore);
      });

      const deliver = (clientId: number, message: RpcMessage.FromServerEncoded) =>
        Effect.suspend(() => {
          if (isDropped) return Effect.void;

          if (message._tag === "Exit") tags.delete(message.requestId);

          return handlers.get(clientId)?.(message) ?? Effect.void;
        });

      /** The push or pull a response answers, or `undefined` for anything else. */
      const answers = (message: RpcMessage.FromServerEncoded) => {
        const tag = message._tag === "Exit" ? tags.get(message.requestId) : undefined;

        return tag === "Sync.push" || tag === "Sync.pull" ? tag : undefined;
      };

      const receive = Effect.fnUntraced(function* ({
        clientId,
        message,
      }: Message<RpcMessage.FromServerEncoded>) {
        const answered = answers(message);

        if (answered !== undefined && (yield* take("dropNextResponse"))) {
          yield* emit("dropNextResponse", answered);

          return yield* drop;
        }

        if ((message._tag === "Exit" || message._tag === "Chunk") && (yield* take("reorderNext"))) {
          const next = yield* Queue.take(down).pipe(Effect.timeoutOption(reorderWindow));

          if (Option.isSome(next)) {
            yield* arrive(next.value.due);
            yield* emit("reorderNext", `${next.value.message._tag} before ${message._tag}`);
            yield* deliver(next.value.clientId, next.value.message);
          }
        }

        yield* deliver(clientId, message);
      });

      const pump = <A>(
        queue: Queue.Queue<Message<A>>,
        handle: (message: Message<A>) => Effect.Effect<void>,
      ) =>
        Effect.forkIn(
          Effect.forever(
            Effect.flatMap(Queue.take(queue), (message) =>
              Effect.andThen(arrive(message.due), handle(message)),
            ),
          ),
          outer,
        );

      yield* pump(up, send);
      yield* pump(down, receive);

      const protocol: RpcClient.Protocol["Service"] = {
        ...connected.protocol,
        send: (clientId, message) =>
          isDropped ? Effect.fail(dropped) : stamp(up, clientId, message),
        run: (clientId, handler) =>
          Effect.suspend(() => {
            handlers.set(clientId, handler);

            return connected.protocol.run(clientId, (message) => stamp(down, clientId, message));
          }).pipe(Effect.ensuring(Effect.sync(() => handlers.delete(clientId)))),
      };

      return {
        protocol,
        closed: Effect.raceFirst(connected.closed, Deferred.await(closedBy)),
      } satisfies Ports.Connected;
    }),
  });

  return {
    settings,
    /** Every fault as it fires from now on, until the scope closes. */
    subscribe: PubSub.subscribe(events),
    transport,

    setOffline: Effect.fn("Faults.setOffline")(function* (offline: boolean) {
      const before = yield* SubscriptionRef.getAndUpdate(settings, (current) => ({
        ...current,
        offline,
      }));

      if (before.offline === offline) return;
      yield* emit(offline ? "offline" : "online", "");

      if (offline) yield* dropAll;
    }),

    setLatency: Effect.fn("Faults.setLatency")(function* (latency: Duration.Duration) {
      yield* SubscriptionRef.update(settings, (current) => ({ ...current, latency }));
      yield* emit("latency", `${Duration.toMillis(latency)} ms`);
    }),

    arm: (fault: OneShot) =>
      SubscriptionRef.update(settings, (current) => ({ ...current, [fault]: true })),

    forge: (forge: Forge) =>
      SubscriptionRef.update(settings, (current) => ({ ...current, forge: Option.some(forge) })),

    /** Drops the open connections now. The engine reconnects as after a lost network. */
    disconnect: Effect.andThen(emit("disconnect", ""), dropAll),
  };
});

export type Faults = Effect.Success<typeof make>;
