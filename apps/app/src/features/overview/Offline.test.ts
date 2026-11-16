import { assert, describe, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { Offline } from "./Offline.ts";

describe("Offline", () => {
  it.effect("shows going offline after 2 seconds, and coming back at once", () =>
    Effect.gen(function* () {
      const after = (millis: number, disconnected: boolean) =>
        Stream.fromEffect(Effect.as(Effect.sleep(millis), disconnected));

      // Online from 0.5 s, a blip of 1.5 s between two attempts to connect, then 3 s offline.
      const disconnected = after(500, false).pipe(
        Stream.concat(after(1000, true)),
        Stream.concat(after(1500, false)),
        Stream.concat(after(2500, true)),
        Stream.concat(after(3000, false)),
      );

      const shown = yield* Offline.shown(disconnected).pipe(
        Stream.mapEffect((offline) =>
          Effect.map(Clock.currentTimeMillis, (millis) => [millis, offline] as const),
        ),
        Stream.runCollect,
        Effect.forkChild,
      );

      yield* TestClock.adjust(10_000);

      assert.deepStrictEqual(yield* Fiber.join(shown), [
        [500, false],
        [7500, true],
        [8500, false],
      ]);
    }),
  );
});
