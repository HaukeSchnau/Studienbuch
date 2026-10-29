/**
 * The one owner of the device's connection: it connects whenever the device may, runs rounds of
 * push and pull, and reconnects after a drop with a jittered backoff (`backoff`), because every
 * beta deploy drops all sockets at once.
 */
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Data from "effect/Data";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FiberHandle from "effect/FiberHandle";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Queue from "effect/Queue";
import * as Random from "effect/Random";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcMessage from "effect/rpc/RpcMessage";
import type * as Scope from "effect/Scope";
import type * as SqlError from "effect/sql/SqlError";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { Connection } from "../protocol/Connection.ts";
import { Protocol } from "../protocol/Protocol.ts";
import type { Ports } from "./Ports.ts";
import { Replication } from "./Replication.ts";

export * as Supervisor from "./Supervisor.ts";

/** One open connection as the supervisor uses it. */
export interface Link {
  readonly remote: Replication.Remote;
  /** The server's pokes, from a subscription made when the link opened. */
  readonly events: Stream.Stream<Protocol.Event, Replication.Disconnected>;
  /** Completes with the close code once the connection ended. */
  readonly closed: Effect.Effect<number>;
}

/** The engine's calls over a connection, with its retries left to the supervisor. */
export const overRpc = Effect.fnUntraced(function* (
  connected: Ports.Connected,
  contract: Protocol.Contract,
) {
  // Effect's default request ids count per process, so a seeded simulation and its replay in
  // another process would send different frames. Each connection counts from 0 instead.
  let requests = 0;

  const client = yield* RpcClient.make(Protocol.Rpcs, {
    generateRequestId: () => RpcMessage.RequestId(requests++),
  }).pipe(Effect.provideService(RpcClient.Protocol, connected.protocol));

  const disconnected = () => new Replication.Disconnected();

  return {
    remote: {
      push: (request) =>
        client["Sync.push"](request).pipe(
          Effect.catchTags({ RpcClientError: () => Effect.fail(disconnected()) }),
        ),
      pull: (request) =>
        client["Sync.pull"](request).pipe(
          Effect.catchTags({ RpcClientError: () => Effect.fail(disconnected()) }),
        ),
    },
    events: client["Sync.events"]({ contract }).pipe(
      Stream.catchTags({ RpcClientError: () => Stream.fail(disconnected()) }),
    ),
    closed: connected.closed,
  } satisfies Link;
});

/** A round after a local write waits this long, so a burst of writes runs one round. */
export const debounce = Duration.millis(100);

/**
 * A poke waits up to this much longer, at random, so an import or a deploy doesn't make a whole
 * school pull at the same instant.
 */
export const pokeSpread = Duration.seconds(2);

/** While connected, a round runs every 2.5 to 5 minutes, at random, in case a poke was lost. */
export const pullEvery = Duration.minutes(5);

/** A connection this old counts as working, so the backoff starts over when it drops. */
export const stableAfter = Duration.seconds(30);

/** A background this long ends with a new socket, since the old one is likely dead. */
export const replaceAfter = Duration.seconds(30);

/** The longest wait between two attempts. */
export const maxBackoff = Duration.minutes(5);

/** The ceiling after the `failures`-th failure in a row: 1 s, doubling to `maxBackoff`. */
export const ceiling = (failures: number) =>
  Math.min(Duration.toMillis(maxBackoff), 1_000 * 2 ** Math.max(0, failures - 1));

/** The wait after the `failures`-th failure in a row: anywhere from 0 to the ceiling. */
export const backoff = (failures: number) =>
  Effect.map(Random.next, (random) => Duration.millis(Math.round(ceiling(failures) * random)));

const between = (low: Duration.Duration, high: Duration.Duration) =>
  Effect.map(Random.next, (random) =>
    Duration.millis(
      Duration.toMillis(low) +
        Math.round((Duration.toMillis(high) - Duration.toMillis(low)) * random),
    ),
  );

export type Connection = "offline" | "connecting" | "online";

export interface Options {
  /** Opens a link, which its scope closes. */
  readonly connect: Effect.Effect<Link, Ports.ConnectFailed, Scope.Scope>;
  /** One round of push and pull. */
  readonly replicate: SyncRound;
  readonly session: Ports.Session["Service"];
  readonly lifecycle: Ports.Lifecycle["Service"];
  /** Emits after each local write. */
  readonly writes: Stream.Stream<void>;
  /** The engine's offline latch: while true, the device stays disconnected. */
  readonly offline: SubscriptionRef.SubscriptionRef<boolean>;
  readonly report: (connection: Connection) => Effect.Effect<void>;
  /** The server closed with 4426: this app is too old for it. */
  readonly outdated: Effect.Effect<void>;
}

type SyncRound = (
  remote: Replication.Remote,
) => Effect.Effect<Replication.Outcome, Replication.Disconnected | SqlError.SqlError>;

interface Conditions {
  readonly offline: boolean;
  readonly online: boolean;
  readonly foreground: boolean;
  /** Counts the session's tokens, so a wait can tell a new sign-in from the old token. */
  readonly token: Option.Option<number>;
}

const ready = (conditions: Conditions) =>
  !conditions.offline && conditions.online && Option.isSome(conditions.token);

/** How an attempt ended. */
type End = Data.TaggedEnum<{
  /** The connection failed or dropped. */
  Dropped: { readonly code: Option.Option<number>; readonly stable: boolean };
  SessionEnded: {};
  /** The server needs a newer app, or removed this device: no more attempts. */
  Stopped: { readonly reason: "update-required" | "revoked" };
  /** The device may no longer connect, or the socket is to be replaced. */
  Interrupted: {};
}>;

const End = Data.taggedEnum<End>();

/** The end a close code means for an attempt. */
const closedWith = (code: number, stable: boolean): End =>
  code === Connection.CloseCode.sessionEnded
    ? End.SessionEnded()
    : code === Connection.CloseCode.updateRequired
      ? End.Stopped({ reason: "update-required" })
      : End.Dropped({ code: Option.some(code), stable });

const tagOf = (cause: Cause.Cause<unknown>) => {
  const squashed = Cause.squash(cause);

  return Predicate.hasProperty(squashed, "_tag") && Predicate.isString(squashed._tag)
    ? squashed._tag
    : "defect";
};

/** Runs until its scope closes. The engine forks it when it starts. */
export const run = Effect.fnUntraced(function* (options: Options) {
  const conditions = yield* SubscriptionRef.make<Conditions>({
    offline: false,
    online: true,
    foreground: true,
    token: Option.none(),
  });

  /**
   * Wakes a waiting backoff and starts its ladder over ("reset"): the latch lifting, a new token,
   * the network coming back, a return to the foreground. Or ends the attempt so a new socket
   * opens ("replace"). Going offline or to the background wakes nothing.
   */
  const wakeups = yield* Queue.sliding<"reset" | "replace">(4);
  /** Asks the running connection for a round. */
  const rounds = yield* Queue.sliding<void>(1);

  const update = (change: (current: Conditions) => Conditions) =>
    SubscriptionRef.update(conditions, change);

  const waitFor = (predicate: (current: Conditions) => boolean) =>
    SubscriptionRef.changes(conditions).pipe(Stream.filter(predicate), Stream.runHead);

  let tokens = 0;

  yield* options.session.changes.pipe(
    Stream.runForEach((token) =>
      Effect.andThen(
        Option.isSome(token) ? Queue.offer(wakeups, "reset") : Effect.void,
        update((current) => ({
          ...current,
          token: Option.isSome(token) ? Option.some((tokens += 1)) : Option.none(),
        })),
      ),
    ),
    Effect.forkScoped,
  );

  yield* SubscriptionRef.changes(options.offline).pipe(
    Stream.runForEach((offline) =>
      Effect.gen(function* () {
        const before = yield* SubscriptionRef.get(conditions);

        if (before.offline && !offline) yield* Queue.offer(wakeups, "reset");
        yield* update((current) => ({ ...current, offline }));
      }),
    ),
    Effect.forkScoped,
  );

  let backgroundSince: Option.Option<number> = Option.none();

  yield* options.lifecycle.changes.pipe(
    Stream.runForEach((state) =>
      Effect.gen(function* () {
        const before = yield* SubscriptionRef.get(conditions);
        const now = yield* Clock.currentTimeMillis;

        if (!before.online && state.online) yield* Queue.offer(wakeups, "reset");

        if (!before.foreground && state.foreground) {
          const away = Option.match(backgroundSince, { onNone: () => 0, onSome: (at) => now - at });
          backgroundSince = Option.none();

          yield* Queue.offer(
            wakeups,
            away >= Duration.toMillis(replaceAfter) ? "replace" : "reset",
          );
          yield* Queue.offer(rounds, undefined);
        }

        // A wakeup goes in before the change it follows, so the attempt the change allows clears
        // it instead of the backoff after that attempt taking it.
        yield* update((current) => ({ ...current, ...state }));

        if (before.foreground && !state.foreground) backgroundSince = Option.some(now);
      }),
    ),
    Effect.forkScoped,
  );

  yield* options.writes.pipe(
    Stream.runForEach(() => Queue.offer(rounds, undefined)),
    Effect.forkScoped,
  );

  /**
   * Rounds over one link until `stop` completes. Nothing interrupts a round: a page commits
   * together with its settled commands and their handles, and a round on a dead socket fails by
   * itself. `stop` is checked between rounds.
   */
  const work = Effect.fnUntraced(function* (link: Link, stop: Deferred.Deferred<End>) {
    // Rounds the server asked to repeat, or that failed on the device, in a row. They climb the
    // reconnects' ladder, so a command that can't go out yet doesn't pull every second, and a
    // poke or a write still runs a round at once.
    let retries = 0;
    const timer = yield* FiberHandle.make();

    const retryLater = Effect.gen(function* () {
      retries += 1;
      const wait = yield* backoff(retries);
      yield* FiberHandle.run(
        timer,
        Effect.andThen(Effect.sleep(wait), Queue.offer(rounds, undefined)),
      );
    });

    const nextOrStop = <A>(effect: Effect.Effect<A>) =>
      Effect.raceFirst(
        Effect.map(effect, () => Option.none<End>()),
        Effect.map(Deferred.await(stop), Option.some),
      );

    yield* Queue.offer(rounds, undefined);

    for (;;) {
      const stopped = yield* nextOrStop(Effect.andThen(Queue.take(rounds), Effect.sleep(debounce)));

      if (Option.isSome(stopped)) return stopped.value;
      yield* Queue.clear(rounds);
      const exit = yield* Effect.exit(options.replicate(link.remote));

      if (Exit.isSuccess(exit)) {
        switch (exit.value) {
          case "idle":
            retries = 0;
            break;
          case "retry":
            yield* retryLater;
            break;
          case "update-required":
          case "revoked":
            return End.Stopped({ reason: exit.value });
        }
      } else if (Cause.hasInterruptsOnly(exit.cause)) {
        return yield* Effect.failCause(exit.cause);
      } else if (
        Option.exists(
          Cause.findErrorOption(exit.cause),
          (error) => error._tag === "SyncClient.Disconnected",
        )
      ) {
        // The socket's close code reaches `stop` before the calls in flight fail.
        const ended = yield* Effect.timeoutOption(Deferred.await(stop), Duration.zero);

        return Option.getOrElse(ended, () => End.Dropped({ code: Option.none(), stable: false }));
      } else {
        yield* Effect.logWarning("A round failed on the device", { failure: tagOf(exit.cause) });
        yield* retryLater;
      }

      if (yield* Deferred.isDone(stop)) return yield* Deferred.await(stop);
    }
  });

  const attempt = Effect.fnUntraced(function* (stop: Deferred.Deferred<End>) {
    const connected = yield* Effect.raceFirst(
      Effect.asSome(Effect.result(options.connect)),
      Effect.as(Deferred.await(stop), Option.none()),
    );

    if (Option.isNone(connected)) return yield* Deferred.await(stop);
    const link = connected.value;

    if (link._tag === "Failure") {
      return link.failure.reason === "session-ended"
        ? End.SessionEnded()
        : End.Dropped({ code: Option.none(), stable: false });
    }

    // The connection counts as working 30 s after the server first answered on it.
    let answeredAt = Option.none<number>();

    yield* link.success.closed.pipe(
      Effect.flatMap((code) =>
        Effect.flatMap(Clock.currentTimeMillis, (now) =>
          Deferred.succeed(
            stop,
            closedWith(
              code,
              Option.exists(answeredAt, (at) => now - at >= Duration.toMillis(stableAfter)),
            ),
          ),
        ),
      ),
      Effect.forkScoped,
    );

    // A poke only hints, so the events stream is drained at once, and the round it asks for
    // waits a random part of `pokeSpread`.
    const pokes = yield* Queue.sliding<void>(1);

    yield* link.success.events.pipe(
      Stream.runForEach(() => Queue.offer(pokes, undefined)),
      Effect.ignore,
      Effect.forkScoped,
    );

    yield* Queue.take(pokes).pipe(
      Effect.andThen(Effect.flatMap(between(Duration.zero, pokeSpread), Effect.sleep)),
      Effect.andThen(Queue.offer(rounds, undefined)),
      Effect.forever,
      Effect.forkScoped,
    );

    yield* Effect.flatMap(
      between(Duration.millis(Duration.toMillis(pullEvery) / 2), pullEvery),
      Effect.sleep,
    ).pipe(Effect.andThen(Queue.offer(rounds, undefined)), Effect.forever, Effect.forkScoped);

    // Online once the server answers on this connection, not when the socket was asked for.
    const online = <A, E>(effect: Effect.Effect<A, E>) =>
      Effect.tap(effect, () =>
        Option.isSome(answeredAt)
          ? Effect.void
          : Effect.flatMap(Clock.currentTimeMillis, (now) =>
              Effect.andThen(
                Effect.sync(() => (answeredAt = Option.some(now))),
                options.report("online"),
              ),
            ),
      );

    const remote: Replication.Remote = {
      push: (request) => online(link.success.remote.push(request)),
      pull: (request) => online(link.success.remote.pull(request)),
    };

    return yield* work({ ...link.success, remote }, stop);
  });

  const interrupted = End.Interrupted();

  let failures = 0;
  let revocationChecked = false;

  for (;;) {
    yield* options.report("offline");
    yield* waitFor(ready);
    yield* options.report("connecting");
    // A wakeup from before this attempt doesn't end it.
    yield* Queue.clear(wakeups);

    const end: End = yield* Effect.scoped(
      Effect.gen(function* () {
        const stop = yield* Deferred.make<End>();

        yield* waitFor((current) => !ready(current)).pipe(
          Effect.andThen(Deferred.succeed(stop, interrupted)),
          Effect.forkScoped,
        );

        yield* Queue.take(wakeups).pipe(
          Effect.repeat({ until: (wakeup) => wakeup === "replace" }),
          Effect.andThen(Deferred.succeed(stop, interrupted)),
          Effect.forkScoped,
        );

        return yield* attempt(stop);
      }),
    );

    switch (end._tag) {
      case "Stopped":
        if (end.reason === "update-required") yield* options.outdated;
        yield* options.report("offline");

        return yield* Effect.never;
      case "Interrupted":
        failures = 0;
        continue;
      case "SessionEnded": {
        yield* options.report("offline");
        yield* options.session.ended;
        const ended = tokens;
        yield* waitFor((next) => Option.exists(next.token, (token) => token > ended));
        failures = 0;
        continue;
      }

      case "Dropped": {
        // 4403 never wipes by itself: connect once more, and the pull answers whether the server
        // removed this device.
        if (Option.contains(end.code, Connection.CloseCode.deviceRevoked) && !revocationChecked) {
          revocationChecked = true;
          continue;
        }

        revocationChecked = false;
        failures = end.stable ? 1 : failures + 1;
        yield* options.report("offline");

        const woken = yield* Effect.raceFirst(
          Effect.as(Effect.flatMap(backoff(failures), Effect.sleep), false),
          Effect.as(Queue.take(wakeups), true),
        );

        if (woken) failures = 0;
      }
    }
  }
});
