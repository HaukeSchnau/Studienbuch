import { assert, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Scope from "effect/Scope";

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

// A refusal's write goes on after the screen that caused it unmounts, and stops at sign-out.
it.effect("work in the engine's scope outlives the screen that waits for it, not the engine", () =>
  Effect.gen(function* () {
    const engine = yield* Scope.make();

    const inEngine = <A, E>(effect: Effect.Effect<A, E>) =>
      AccountEngine.inEngineScope(effect).pipe(
        Effect.provideService(AccountEngine.EngineScope, engine),
      );

    const started = yield* Deferred.make<void>();
    const gate = yield* Deferred.make<void>();
    const written = yield* Deferred.make<void>();

    const screen = yield* Effect.forkChild(
      inEngine(
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(gate)),
          Effect.andThen(Deferred.succeed(written, undefined)),
        ),
      ),
    );

    yield* Deferred.await(started);
    yield* Fiber.interrupt(screen);
    yield* Deferred.succeed(gate, undefined);
    yield* Deferred.await(written);

    const pending = yield* Deferred.make<void>();

    const late = yield* Effect.forkChild(
      inEngine(Effect.andThen(Deferred.succeed(pending, undefined), Effect.never)),
    );

    yield* Deferred.await(pending);
    yield* Scope.close(engine, Exit.void);

    assert.isTrue(Exit.hasInterrupts(yield* Fiber.await(late)));
  }),
);
