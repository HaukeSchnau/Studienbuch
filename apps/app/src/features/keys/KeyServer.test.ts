import { assert, it } from "@effect/vitest";
import { Api } from "@stu/api";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as RpcClient from "effect/rpc/RpcClient";
import * as TestClock from "effect/testing/TestClock";

import { Deadline } from "../../infra/api/Deadline.ts";
import { KeyServer } from "./KeyServer.ts";

/** A server that takes the request and stays silent, or answers and stops in the middle of the body. */
const answering = (answer: "silence" | "stalled body") =>
  KeyServer.layer.pipe(
    Layer.provide(RpcClient.layerProtocolHttp({ url: `https://one.example${Api.path}` })),
    Layer.provide([
      Api.serialization,
      Layer.succeed(HttpClient.HttpClient)(
        HttpClient.make((request) =>
          answer === "silence"
            ? Effect.never
            : Effect.succeed(
                HttpClientResponse.fromWeb(request, new Response(new ReadableStream())),
              ),
        ),
      ),
    ]),
  );

const stateFrom = (answer: "silence" | "stalled body") =>
  Effect.flatMap(KeyServer.Service, (server) => server.state).pipe(
    Effect.flip,
    Effect.map((error) => error._tag),
    Effect.provide(answering(answer)),
  );

// A key call that never ends would hold "Ich habe ihn aufgeschrieben" for good. A late one counts
// as offline, which every key step already handles.
it.effect("gives up on a key answer that doesn't come in time", () =>
  Effect.gen(function* () {
    const silent = yield* Effect.forkChild(stateFrom("silence"));
    const stalled = yield* Effect.forkChild(stateFrom("stalled body"));

    yield* TestClock.adjust(Deadline.answerWithin);

    assert.deepStrictEqual(
      [yield* Fiber.join(silent), yield* Fiber.join(stalled)],
      ["KeyServer.Unreachable", "KeyServer.Unreachable"],
    );
  }),
);
