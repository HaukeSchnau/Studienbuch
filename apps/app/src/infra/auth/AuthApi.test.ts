import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as TestClock from "effect/testing/TestClock";

import { AuthApi } from "./AuthApi.ts";

type Answer = Response | "no answer" | "silence";

/**
 * A server that answers every request the same way, doesn't answer at all, or takes the request
 * and stays silent.
 */
const answering = (answer: Answer) =>
  AuthApi.layer.pipe(
    Layer.provide(
      Layer.succeed(HttpClient.HttpClient)(
        HttpClient.make((request) => {
          if (answer === "silence") return Effect.never;

          return answer === "no answer"
            ? Effect.fail(
                new HttpClientError.HttpClientError({
                  reason: new HttpClientError.TransportError({ request }),
                }),
              )
            : Effect.succeed(HttpClientResponse.fromWeb(request, answer.clone()));
        }),
      ),
    ),
    Layer.provide(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
  );

const signInAgainst = (answer: Answer) =>
  Effect.flatMap(AuthApi.Service, (api) => api.signIn("lena@example.org", "lange-genug-123")).pipe(
    Effect.flip,
    Effect.map((error) => error._tag),
    Effect.provide(answering(answer)),
  );

// "Keine Verbindung" is only true when nothing answered. A server that broke says so.
it.effect("tells no answer from a server that failed or answered nonsense", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(
      [
        yield* signInAgainst("no answer"),
        yield* signInAgainst(new Response("Bad Gateway", { status: 502 })),
        yield* signInAgainst(new Response("<html>", { status: 200 })),
        yield* signInAgainst(Response.json({ code: "INVALID_EMAIL_OR_PASSWORD" }, { status: 401 })),
      ],
      ["AuthApi.Unreachable", "AuthApi.ServerFailed", "AuthApi.ServerFailed", "AuthApi.Refused"],
    );
  }),
);

// A server that takes the request and never answers, or stops in the middle of the body, holds a
// sign-in no longer than a lost answer would.
it.effect("gives up on an answer that doesn't come in time", () =>
  Effect.gen(function* () {
    const silent = yield* Effect.forkChild(signInAgainst("silence"));

    const stalled = yield* Effect.forkChild(
      signInAgainst(new Response(new ReadableStream(), { status: 200 })),
    );

    yield* TestClock.adjust(AuthApi.answerWithin);

    assert.deepStrictEqual(
      [yield* Fiber.join(silent), yield* Fiber.join(stalled)],
      ["AuthApi.Unreachable", "AuthApi.Unreachable"],
    );
  }),
);
