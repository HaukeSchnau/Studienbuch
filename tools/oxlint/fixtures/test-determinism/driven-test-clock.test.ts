import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as TestClock from "effect/testing/TestClock";

// A sleep on a TestClock the test drives passes.
it.effect("ends a minute's sleep", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(Effect.sleep("1 minute"));

    yield* TestClock.adjust("1 minute");
    yield* Fiber.join(fiber);
  }),
);
