import { assert, it } from "@effect/vitest";
import { Ports } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";

import { AuthApi } from "./AuthApi.ts";

/** A server that answers every request the same way, or doesn't answer at all. */
const answering = (answer: Response | "no answer") =>
  AuthApi.layer.pipe(
    Layer.provide(
      Layer.succeed(HttpClient.HttpClient)(
        HttpClient.make((request) =>
          answer === "no answer"
            ? Effect.fail(
                new HttpClientError.HttpClientError({
                  reason: new HttpClientError.TransportError({ request }),
                }),
              )
            : Effect.succeed(HttpClientResponse.fromWeb(request, answer.clone())),
        ),
      ),
    ),
    Layer.provide(Layer.succeed(Ports.Server)({ origin: new URL("https://one.example") })),
  );

const signInAgainst = (answer: Response | "no answer") =>
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
