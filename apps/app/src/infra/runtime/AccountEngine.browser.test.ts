import { assert, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { SessionStore } from "../auth/SessionStore.ts";
import { Device } from "../device/Device.ts";
import { AccountEngine } from "./AccountEngine.ts";
import { Layers } from "./Layers.ts";

const signedIn = (accountId: string) => ({
  accountId,
  token: Redacted.make(`token-${accountId}`),
  demo: false,
});

// The engine picks the account's storage when it opens: on disk only for a session the device
// keeps, so a public computer's account, or one without a session, writes nothing that outlives it.
it.effect("opens an account's engine where its session chose, and in memory without one", () =>
  Effect.gen(function* () {
    const sessions = yield* SessionStore.Service;
    const engines = yield* AccountEngine.Engines;

    const inMemory = (accountId: string) =>
      Effect.flatMap(engines.context(accountId), (context) =>
        Effect.as(engines.close(accountId), Context.get(context, Device.PublicComputer)),
      );

    yield* sessions.signedIn(signedIn("lena"), false);

    const kept = yield* inMemory("lena");
    const withoutSession = yield* inMemory("tom");

    yield* sessions.forget;
    yield* sessions.signedIn(signedIn("tom"), true);

    const publicComputer = yield* inMemory("tom");

    assert.deepStrictEqual(
      { kept, withoutSession, publicComputer },
      { kept: false, withoutSession: true, publicComputer: true },
    );
  }).pipe(
    Effect.provide(
      AccountEngine.engines.pipe(
        Layer.provideMerge(SessionStore.layer),
        Layer.provideMerge(Layers.device({ name: "engines" })),
      ),
    ),
  ),
);
