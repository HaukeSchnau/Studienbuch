import { describe, expect, it } from "@effect/vitest";
import type * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Queue from "effect/Queue";
import * as Random from "effect/Random";
import * as Redacted from "effect/Redacted";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
import { Connection } from "../protocol/Connection.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Ports } from "./Ports.ts";
import type { Replication } from "./Replication.ts";
import { Supervisor } from "./Supervisor.ts";

/** A link the test closes and pokes, which logs its subscription and its end. */
const makeLink = Effect.fnUntraced(function* (log: Array<string>) {
  const closed = yield* Deferred.make<number>();
  const pokes = yield* Queue.unbounded<Protocol.Event, Cause.Done>();

  const remote: Replication.Remote = {
    push: () => Effect.die("The supervisor's rounds are faked"),
    pull: () => Effect.die("The supervisor's rounds are faked"),
  };

  const link: Supervisor.Link = {
    remote,
    events: Stream.unwrap(
      Effect.sync(() => {
        log.push("events");

        return Stream.fromQueue(pokes);
      }),
    ),
    closed: Deferred.await(closed),
  };

  return {
    link,
    /** Ends the events first, so the close code has to win over the ended stream. */
    close: (code: number) => Effect.andThen(Queue.end(pokes), Deferred.succeed(closed, code)),
    poke: Queue.offer(pokes, Protocol.Poke.make({ spaces: [] })),
    /** Ends the events on an open socket, as the server does with a second subscription. */
    unsubscribe: Queue.end(pokes),
  };
});

/** `unsubscribed` is a link whose events the server ends at once. */
type Script = ReadonlyArray<"unreachable" | "session-ended" | "link" | "unsubscribed">;

/**
 * Runs the supervisor with a scripted transport: each attempt takes the script's next answer,
 * and answers `unreachable` once the script runs out.
 */
const harnessWith = Effect.fnUntraced(function* (
  script: Script,
  round: (log: Array<string>) => Effect.Effect<Replication.Outcome>,
  pullEvery = Supervisor.pullEvery,
) {
  const log: Array<string> = [];
  const attempts: Array<number> = [];
  const links: Array<Effect.Success<ReturnType<typeof makeLink>>> = [];

  const lifecycle = yield* SubscriptionRef.make<Ports.LifecycleState>({
    foreground: true,
    online: true,
  });

  const token = yield* SubscriptionRef.make(Option.some(Redacted.make("token-1")));
  const offline = yield* SubscriptionRef.make(false);
  const writes = yield* PubSub.unbounded<void>();
  let ended = 0;
  const reports: Array<Supervisor.Connection> = [];
  let outdated = 0;

  const remaining = [...script];

  const connect = Effect.gen(function* () {
    attempts.push(yield* Clock.currentTimeMillis);
    log.push("connect");
    const next = remaining.shift() ?? "unreachable";

    if (next !== "link" && next !== "unsubscribed") {
      return yield* new Ports.ConnectFailed({ reason: next });
    }

    const made = yield* makeLink(log);
    links.push(made);
    yield* Effect.addFinalizer(() => Effect.sync(() => log.push("closed")));

    if (next === "unsubscribed") yield* made.unsubscribe;

    return made.link;
  });

  yield* Supervisor.run({
    connect,
    replicate: () => round(log),
    session: {
      accountId: "account-lena",
      token: SubscriptionRef.get(token),
      changes: SubscriptionRef.changes(token),
      ended: Effect.sync(() => {
        ended += 1;
      }),
    },
    lifecycle: { changes: SubscriptionRef.changes(lifecycle) },
    writes: Stream.fromPubSub(writes),
    offline,
    report: (connection) => Effect.sync(() => void reports.push(connection)),
    outdated: Effect.sync(() => {
      outdated += 1;
    }),
    pullEvery,
  }).pipe(Effect.forkScoped);

  // Lets the forked fibers start before the test moves the clock.
  yield* TestClock.adjust(0);

  return {
    log,
    attempts,
    links,
    lifecycle,
    token,
    offline,
    write: PubSub.publish(writes, undefined),
    ended: () => ended,
    reports,
    outdated: () => outdated,
  };
});

/** The harness with rounds that log `round` and end with `outcome`. */
const harness = (
  script: Script,
  outcome: () => Replication.Outcome = () => "idle",
  pullEvery = Supervisor.pullEvery,
) =>
  harnessWith(
    script,
    (log) =>
      Effect.sync(() => {
        log.push("round");

        return outcome();
      }),
    pullEvery,
  );

describe("Supervisor", () => {
  it.effect("connects, subscribes to events, then runs a round", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link"]);
      yield* TestClock.adjust(Supervisor.debounce);

      expect(device.log).toEqual(["connect", "events", "round"]);
    }).pipe(Effect.scoped),
  );

  it.effect("pokes, writes and the clock each run one round", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link"]);
      yield* TestClock.adjust(Supervisor.debounce);
      const link = device.links[0];

      if (link === undefined) return yield* Effect.die("No link opened");
      const rounds = () => device.log.filter((entry) => entry === "round").length;

      // A poke waits a random part of `pokeSpread` before its round.
      yield* link.poke;
      yield* link.poke;
      yield* link.poke;
      yield* TestClock.adjust(Supervisor.pokeSpread);
      yield* TestClock.adjust(Supervisor.debounce);
      expect(rounds()).toBe(2);

      yield* device.write;
      yield* TestClock.adjust(Supervisor.debounce);
      expect(rounds()).toBe(3);

      yield* TestClock.adjust(Supervisor.pullEvery);
      yield* TestClock.adjust(Supervisor.debounce);
      expect(rounds()).toBe(4);
    }).pipe(Effect.scoped),
  );

  it.effect("an infinite `pullEvery` leaves the rounds to pokes and writes", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link"], undefined, Duration.infinity);
      const rounds = () => device.log.filter((entry) => entry === "round").length;

      for (let minute = 0; minute < 60; minute++) yield* TestClock.adjust("1 minute");
      expect(rounds()).toBe(1);

      yield* device.write;
      yield* TestClock.adjust(Supervisor.debounce);
      expect(rounds()).toBe(2);
    }).pipe(Effect.scoped),
  );

  it.effect("the backoff stays under a doubling ceiling and follows the seeded Random", () =>
    Effect.gen(function* () {
      const gaps = Effect.gen(function* () {
        const device = yield* harness([]);

        for (let second = 0; second < 70; second++) yield* TestClock.adjust("1 second");

        return device.attempts.slice(1).map((at, index) => at - (device.attempts[index] ?? 0));
      }).pipe(Effect.scoped);

      const first = yield* Random.withSeed(gaps, "lena");
      const again = yield* Random.withSeed(gaps, "lena");
      const other = yield* Random.withSeed(gaps, "tom");

      expect(first.length).toBeGreaterThanOrEqual(5);

      for (const [index, gap] of first.slice(0, 5).entries()) {
        const ceiling = 1_000 * 2 ** index;

        // The clock moves in whole seconds, so a wait ends within the second after it.
        expect(gap).toBeLessThanOrEqual(ceiling + 1_000);
      }

      expect(again).toEqual(first);
      expect(other).not.toEqual(first);
    }),
  );

  it.effect("events the server ends drop the link, and the next link waits for the backoff", () =>
    Effect.gen(function* () {
      const device = yield* harness(Array.from({ length: 20 }, () => "unsubscribed" as const));

      for (let second = 0; second < 60; second++) yield* TestClock.adjust("1 second");

      const count = (entry: string) => device.log.filter((each) => each === entry).length;
      const gaps = device.attempts.slice(1).map((at, index) => at - (device.attempts[index] ?? 0));

      expect(device.attempts.length).toBeGreaterThanOrEqual(3);
      expect(count("events")).toBe(device.attempts.length);
      expect(count("closed")).toBe(device.attempts.length);

      for (const [index, gap] of gaps.entries()) {
        const ceiling = Supervisor.ceiling(index + 1) + Duration.toMillis(Supervisor.closeGrace);

        // The clock moves in whole seconds, so a wait ends within the second after it.
        expect(gap).toBeLessThanOrEqual(ceiling + 1_000);
      }
    }).pipe(Random.withSeed("lena"), Effect.scoped),
  );

  it.effect("a close with 4403 connects once more, and a revoked round stops it", () =>
    Effect.gen(function* () {
      let rounds = 0;
      const device = yield* harness(["link", "link"], () => (++rounds >= 2 ? "revoked" : "idle"));
      yield* TestClock.adjust(Supervisor.debounce);
      yield* device.links[0]?.close(Connection.CloseCode.deviceRevoked) ?? Effect.void;
      yield* TestClock.adjust(0);

      expect(device.attempts).toEqual([0, 100]);
      yield* TestClock.adjust(Supervisor.debounce);
      yield* TestClock.adjust("10 minutes");
      expect(device.attempts).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.effect("a close with 4401 ends the session and waits for a new sign-in", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link", "link"]);
      yield* TestClock.adjust(Supervisor.debounce);
      yield* device.links[0]?.close(Connection.CloseCode.sessionEnded) ?? Effect.void;
      yield* TestClock.adjust("10 minutes");

      expect(device.ended()).toBe(1);
      expect(device.attempts).toHaveLength(1);
      expect(device.reports.at(-1)).toBe("offline");

      yield* SubscriptionRef.set(device.token, Option.some(Redacted.make("token-2")));
      yield* TestClock.adjust(0);
      expect(device.attempts).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.effect("the offline latch closes the connection until it is lifted", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link", "link"]);
      yield* TestClock.adjust(Supervisor.debounce);
      yield* SubscriptionRef.set(device.offline, true);
      yield* TestClock.adjust("10 minutes");

      expect(device.log.filter((entry) => entry === "closed")).toHaveLength(1);
      expect(device.attempts).toHaveLength(1);

      yield* SubscriptionRef.set(device.offline, false);
      yield* TestClock.adjust(0);
      expect(device.attempts).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.effect("a long background replaces the socket, and a short one keeps it", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link", "link"]);
      yield* TestClock.adjust(Supervisor.debounce);

      yield* SubscriptionRef.set(device.lifecycle, { foreground: false, online: true });
      yield* TestClock.adjust("5 seconds");
      yield* SubscriptionRef.set(device.lifecycle, { foreground: true, online: true });
      yield* TestClock.adjust(Supervisor.debounce);
      expect(device.attempts).toHaveLength(1);

      yield* SubscriptionRef.set(device.lifecycle, { foreground: false, online: true });
      yield* TestClock.adjust(Supervisor.replaceAfter);
      yield* SubscriptionRef.set(device.lifecycle, { foreground: true, online: true });
      yield* TestClock.adjust(0);
      expect(device.attempts).toHaveLength(2);
      expect(device.log.filter((entry) => entry === "closed")).toHaveLength(1);
    }).pipe(Effect.scoped),
  );
});

describe("Supervisor rounds", () => {
  it.effect("rounds the server asks to repeat back off, and a poke still runs one at once", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link"], () => "retry");
      const rounds = () => device.log.filter((entry) => entry === "round").length;

      for (let second = 0; second < 30; second++) yield* TestClock.adjust("1 second");

      // Waits drawn below 1, 2, 4, 8 and 16 s: far fewer rounds than one per debounce.
      expect(rounds()).toBeLessThanOrEqual(10);
      expect(device.attempts).toHaveLength(1);

      const before = rounds();
      yield* device.write;
      yield* TestClock.adjust(Supervisor.debounce);
      expect(rounds()).toBe(before + 1);
    }).pipe(Random.withSeed("lena"), Effect.scoped),
  );

  it.effect("a socket closing during a round lets the round finish", () =>
    Effect.gen(function* () {
      const release = yield* Deferred.make<void>();
      const finished: Array<string> = [];

      const device = yield* harnessWith(["link", "link"], () =>
        Effect.gen(function* () {
          yield* Deferred.await(release);
          finished.push("round");

          return "idle" as const;
        }),
      );

      yield* TestClock.adjust(Supervisor.debounce);
      yield* device.links[0]?.close(1006) ?? Effect.void;
      yield* TestClock.adjust(0);
      expect(device.attempts).toHaveLength(1);

      yield* Deferred.succeed(release, undefined);
      yield* TestClock.adjust(0);
      expect(finished).toEqual(["round"]);
      yield* TestClock.adjust(Supervisor.ceiling(1));
      expect(device.attempts).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.effect("a round that dies is logged and run again later", () =>
    Effect.gen(function* () {
      let calls = 0;

      const device = yield* harnessWith(["link"], () =>
        Effect.suspend(() =>
          ++calls === 1 ? Effect.die("A bug in a round") : Effect.succeed("idle" as const),
        ),
      );

      yield* TestClock.adjust(Supervisor.debounce);
      yield* TestClock.adjust(Supervisor.ceiling(1));
      yield* TestClock.adjust(Supervisor.debounce);

      expect(calls).toBe(2);
      expect(device.attempts).toHaveLength(1);
    }).pipe(Effect.scoped),
  );

  it.effect("a close with 4426 marks the app outdated and stops", () =>
    Effect.gen(function* () {
      const device = yield* harness(["link", "link"]);
      yield* TestClock.adjust(Supervisor.debounce);
      yield* device.links[0]?.close(Connection.CloseCode.updateRequired) ?? Effect.void;
      yield* TestClock.adjust("10 minutes");

      expect(device.outdated()).toBe(1);
      expect(device.attempts).toHaveLength(1);
    }).pipe(Effect.scoped),
  );

  it.effect("lifting the latch during a backoff connects at once", () =>
    Effect.gen(function* () {
      const device = yield* harness(["unreachable", "unreachable", "unreachable", "link"]);

      for (let second = 0; second < 4; second++) yield* TestClock.adjust("1 second");

      const attempts = device.attempts.length;
      yield* SubscriptionRef.set(device.offline, true);
      yield* TestClock.adjust(0);
      yield* SubscriptionRef.set(device.offline, false);
      yield* TestClock.adjust(0);

      expect(device.attempts.length).toBe(attempts + 1);
    }).pipe(Effect.scoped),
  );

  it.effect(
    "going to the background during a backoff wakes nothing, nor does losing the network",
    () =>
      Effect.gen(function* () {
        const device = yield* harness([]);

        for (let second = 0; second < 4; second++) yield* TestClock.adjust("1 second");

        const attempts = device.attempts.length;
        yield* SubscriptionRef.set(device.lifecycle, { foreground: false, online: true });
        yield* TestClock.adjust(0);
        yield* SubscriptionRef.set(device.lifecycle, { foreground: false, online: false });
        yield* TestClock.adjust(0);

        expect(device.attempts).toHaveLength(attempts);
      }).pipe(Effect.scoped),
  );
});
