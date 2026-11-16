import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as TestClock from "effect/testing/TestClock";
import { Fixture } from "./Fixture.ts";
import { Revocations } from "./Revocations.ts";

it.effect("a session revoked as the layer comes up is remembered", () =>
  Effect.gen(function* () {
    const sessions = yield* Fixture.Sessions;
    const revocations = yield* Revocations.Service;

    yield* sessions.revoke("session-lena");

    const revoked = yield* Effect.forkChild(
      Effect.timeoutOption(revocations.revocation("session-lena"), "1 second"),
    );

    yield* TestClock.adjust("1 second");

    expect(yield* Fiber.join(revoked)).toEqual(Option.some(undefined));
  }).pipe(Effect.provide(Revocations.layer.pipe(Layer.provideMerge(Fixture.sessions)))),
);
