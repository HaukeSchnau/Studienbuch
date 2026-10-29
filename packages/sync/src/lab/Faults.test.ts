import { describe, expect, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Predicate from "effect/Predicate";
import * as PubSub from "effect/PubSub";
import * as Queue from "effect/Queue";
import * as RpcClient from "effect/rpc/RpcClient";
import * as RpcMessage from "effect/rpc/RpcMessage";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import * as TestClock from "effect/testing/TestClock";
// The recorded messages are read once while the test file loads, before any Effect runs.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeFS from "node:fs";
import { Ports } from "../client/Ports.ts";
import { Protocol } from "../protocol/Protocol.ts";
import { Network } from "../simulation/Network.ts";
import { Faults } from "./Faults.ts";

const Line = Schema.fromJsonString(Schema.Struct({ message: Schema.String, json: Schema.Json }));

const decodeLine = Schema.decodeUnknownEffect(Line);

const isMessageLine = (line: string) => line.startsWith('{"message"');

const wire = Effect.forEach(
  NodeFS.readFileSync(new URL("../protocol/wire.jsonl", import.meta.url), "utf8")
    .split("\n")
    .filter(isMessageLine),
  (line) => decodeLine(line),
);

/** The messages `wire.jsonl` records under `name`, decoded with their JSON codec. */
const recorded = <A, I>(name: string, schema: Schema.Codec<A, I>) => {
  const decode = Schema.decodeUnknownEffect(Schema.toCodecJson(schema));

  return Effect.flatMap(wire, (lines) =>
    Effect.forEach(
      lines.filter((line) => line.message === name),
      (line) => decode(line.json),
    ),
  );
};

const fixtures = Effect.all({
  pushes: recorded("Sync.push payload", Protocol.PushRequest),
  pulls: recorded("Sync.pull success", Protocol.PullResponse),
  events: recorded("Sync.events chunk", Protocol.Event),
}).pipe(Effect.orDie);

const session = {
  accountId: "account-lena",
  sessionId: "session-a",
  expiresAt: DateTime.makeUnsafe(0),
};

/**
 * One device on the simulated network, behind faults, talking to stub handlers. They record each
 * push and answer it as applied, answer pulls as told and stream the recorded events.
 */
const harness = Effect.gen(function* () {
  const { pushes, pulls, events } = yield* fixtures;
  // The first recorded push holds an `enrollment.set` and a `Seal` with one write.
  const push = yield* Effect.fromNullishOr(pushes[0]);
  let pullAnswer = yield* Effect.fromNullishOr(pulls[0]);
  const received = yield* Queue.unbounded<Protocol.PushRequest>();
  const frames: Array<Network.Frame> = [];
  const serverEnded = yield* Deferred.make<void>();

  const handlers = Protocol.Rpcs.toLayer({
    "Sync.push": (request) =>
      Effect.as(Queue.offer(received, request), {
        lastMutationId: request.commands.at(-1)?.mutationId ?? 0,
        outcomes: request.commands.map((command) =>
          Protocol.Applied.make({ mutationId: command.mutationId }),
        ),
      }),
    "Sync.pull": () => Effect.sync(() => pullAnswer),
    "Sync.events": () => Stream.concat(Stream.fromIterable(events), Stream.never),
  });

  const network = yield* Network.make(
    (_session, socket) =>
      Network.serveSocket(Protocol.Rpcs, socket).pipe(
        Effect.provide(handlers),
        Effect.ensuring(Deferred.succeed(serverEnded, undefined)),
      ),
    (frame) => Effect.sync(() => frames.push(frame)),
  );

  const faults = yield* Faults.make.pipe(
    Effect.provideService(Faults.Allowed, { environment: "development" }),
  );

  const transport = faults.transport(network.transport({ id: "a", session }));
  const connection = yield* transport.connect;

  // Request ids count per client, so a run and its replay send the same frames.
  let requests = 0;

  const client = yield* RpcClient.make(Protocol.Rpcs, {
    generateRequestId: () => RpcMessage.RequestId(requests++),
  }).pipe(Effect.provideService(RpcClient.Protocol, connection.protocol));

  const pull = {
    clientId: push.clientId,
    syncEpoch: push.syncEpoch,
    contract: push.contract,
    cursors: [],
    settledMutationId: 0,
    limit: 100,
  };

  const answerPullsWith = (response: Protocol.PullResponse) =>
    Effect.sync(() => {
      pullAnswer = response;
    });

  return {
    answerPullsWith,
    client,
    connection,
    events,
    faults,
    frames,
    network,
    pull,
    pulls,
    push,
    pushes,
    received,
    serverEnded,
    transport,
  };
});

describe("Faults on the simulated network", () => {
  it.effect(
    "every recorded push, pull answer and event keeps its fields through the JSON frames",
    () =>
      Effect.gen(function* () {
        const { answerPullsWith, client, events, frames, pull, pulls, pushes, received } =
          yield* harness;

        for (const push of pushes) {
          yield* client["Sync.push"](push);
          expect(yield* Queue.take(received)).toStrictEqual(push);
        }

        for (const response of pulls) {
          yield* answerPullsWith(response);
          expect(yield* client["Sync.pull"](pull)).toStrictEqual(response);
        }

        const streamed = yield* client["Sync.events"]({ contract: pull.contract }).pipe(
          Stream.take(events.length),
          Stream.runCollect,
        );

        expect(streamed).toStrictEqual(events);

        // The ciphertext of the first push's write, as the JSON frame carries it.
        const sent = frames.flatMap((frame) =>
          frame.direction === "up" && Predicate.isString(frame.data) ? [frame.data] : [],
        );

        expect(sent.some((data) => data.includes("AAECAwQFBgc="))).toBe(true);
      }),
  );

  it.effect("latency delays both directions", () =>
    Effect.gen(function* () {
      const { client, faults, push } = yield* harness;

      yield* faults.setLatency(Duration.millis(300));

      const answeredAt = yield* Effect.forkChild(
        Effect.andThen(client["Sync.push"](push), Clock.currentTimeMillis),
      );

      yield* TestClock.adjust(Duration.seconds(1));
      expect(yield* Fiber.join(answeredAt)).toBe(600);
    }),
  );

  it.effect("a dropped response fails the call after the server applied the push", () =>
    Effect.gen(function* () {
      const { client, connection, faults, push, received } = yield* harness;

      yield* faults.arm("dropNextResponse");
      const failure = yield* Effect.flip(client["Sync.push"](push));

      expect(failure).toStrictEqual(Faults.dropped);
      expect(yield* connection.closed).toBe(Faults.droppedCode);
      expect(yield* Queue.take(received)).toStrictEqual(push);
      expect(yield* Effect.flip(client["Sync.push"](push))).toStrictEqual(Faults.dropped);
    }),
  );

  it.effect("a push that never leaves a dropped connection uses up no forge or duplicate", () =>
    Effect.gen(function* () {
      const { client, faults, push } = yield* harness;

      yield* faults.arm("duplicateNextPush");
      yield* faults.forge(Faults.Forge.SealInto({ space: "notebook-tom" }));
      yield* faults.setLatency(Duration.millis(300));

      // Still on its way when the connection drops.
      const queued = yield* Effect.forkChild(client["Sync.push"](push));
      yield* TestClock.adjust(Duration.millis(100));
      yield* faults.disconnect;
      yield* TestClock.adjust(Duration.millis(300));

      expect(yield* Effect.flip(Fiber.join(queued))).toStrictEqual(Faults.dropped);
      expect(yield* Effect.flip(client["Sync.push"](push))).toStrictEqual(Faults.dropped);

      const settings = yield* SubscriptionRef.get(faults.settings);
      expect(settings.duplicateNextPush).toBe(true);
      expect(settings.forge._tag).toBe("Some");
    }),
  );

  it.effect("the log records each fault with its details, latency included", () =>
    Effect.gen(function* () {
      const { client, faults, push, received } = yield* harness;
      const log = yield* faults.subscribe;

      yield* faults.setLatency(Duration.millis(300));
      yield* faults.forge(
        Faults.Forge.RewriteArgs({ mutator: "enrollment.set", args: { courseIds: ["course-x"] } }),
      );
      yield* Effect.forkChild(client["Sync.push"](push));
      yield* TestClock.adjust(Duration.millis(300));
      yield* Queue.take(received);

      const logged = [yield* PubSub.take(log), yield* PubSub.take(log)];

      expect(logged.map(({ fault, detail }) => `${fault} ${detail}`)).toStrictEqual([
        "latency 300 ms",
        'forge RewriteArgs enrollment.set {"courseIds":["course-x"]} on mutation 1',
      ]);
    }),
  );

  it.effect(
    "a duplicated push reaches the server twice, the second time on its own connection",
    () =>
      Effect.gen(function* () {
        const { client, faults, push, received } = yield* harness;

        yield* faults.arm("duplicateNextPush");
        yield* client["Sync.push"](push);

        expect(yield* Queue.take(received)).toStrictEqual(push);
        expect(yield* Queue.take(received)).toStrictEqual(push);
      }),
  );

  it.effect("reorder delivers the second answer first", () =>
    Effect.gen(function* () {
      const { client, faults, pull, push } = yield* harness;
      const finished: Array<string> = [];

      // Both requests are on their way before the first answer comes back.
      yield* faults.setLatency(Duration.millis(100));
      yield* faults.arm("reorderNext");

      const first = yield* Effect.forkChild(
        Effect.tap(client["Sync.pull"](pull), () => Effect.sync(() => finished.push("pull"))),
      );

      const second = yield* Effect.forkChild(
        Effect.tap(client["Sync.push"](push), () => Effect.sync(() => finished.push("push"))),
      );

      yield* TestClock.adjust(Duration.seconds(1));
      yield* Fiber.join(first);
      yield* Fiber.join(second);
      expect(finished).toStrictEqual(["push", "pull"]);
    }),
  );

  it.effect(
    "a forged Seal goes to another space, and a forged Mutate carries other arguments",
    () =>
      Effect.gen(function* () {
        const { client, faults, push, received } = yield* harness;
        const [mutate, seal] = push.commands;

        // A forge for a later command lets an earlier one through as it is, and stays armed.
        yield* faults.forge(
          Faults.Forge.SealInto({ space: "notebook-tom", mutationId: (seal?.mutationId ?? 0) + 1 }),
        );
        yield* client["Sync.push"](push);
        expect(yield* Queue.take(received)).toStrictEqual(push);
        expect((yield* SubscriptionRef.get(faults.settings)).forge._tag).toBe("Some");

        yield* faults.forge(Faults.Forge.SealInto({ space: "notebook-tom" }));
        yield* client["Sync.push"](push);

        const sealed = yield* Queue.take(received);
        expect(sealed.commands[0]).toStrictEqual(mutate);
        expect(
          sealed.commands.flatMap((command) =>
            command._tag === "Seal" ? command.writes.map((write) => write.space) : [],
          ),
        ).toStrictEqual(["notebook-tom"]);

        yield* faults.forge(
          Faults.Forge.RewriteArgs({
            mutator: "enrollment.set",
            args: { courseIds: ["course-x"] },
          }),
        );
        yield* client["Sync.push"](push);

        const mutated = yield* Queue.take(received);
        expect(mutated.commands[0]?._tag === "Mutate" && mutated.commands[0].args).toStrictEqual({
          courseIds: ["course-x"],
        });
        expect(mutated.commands[1]).toStrictEqual(seal);
      }),
  );

  it.effect("offline drops the open connection and refuses new ones until online", () =>
    Effect.gen(function* () {
      const { connection, faults, transport } = yield* harness;

      yield* faults.setOffline(true);
      expect(yield* connection.closed).toBe(Faults.droppedCode);

      const refused = yield* Effect.flip(Effect.scoped(transport.connect));
      expect(refused).toStrictEqual(new Ports.ConnectFailed({ reason: "unreachable" }));

      yield* faults.setOffline(false);
      yield* Effect.scoped(transport.connect);
    }),
  );

  it.effect("a severed network closes the device's end with 1006, and the server's end too", () =>
    Effect.gen(function* () {
      const { connection, network, serverEnded } = yield* harness;

      yield* network.sever("a");
      expect(yield* connection.closed).toBe(1006);
      yield* Deferred.await(serverEnded);
    }),
  );
});
