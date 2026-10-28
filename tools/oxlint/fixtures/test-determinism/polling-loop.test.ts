import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect("spins until an event arrives", () =>
  Effect.gen(function* () {
    const events: Array<number> = [];

    // oxlint-disable-next-line studienbuch/no-polling-loop-in-tests -- fixture: a predicate loop on yieldNow
    while (events.length === 0) {
      yield* Effect.yieldNow;
    }
  }),
);

it("spins on microtask ticks", async () => {
  const state = { ready: false };

  // oxlint-disable-next-line studienbuch/no-polling-loop-in-tests -- fixture: a conditional exit after a tick
  for (;;) {
    await Promise.resolve();

    if (state.ready) break;
  }
});

it("flushes three ticks", async () => {
  // A counter the loop advances bounds it, so this passes.
  for (let tick = 0; tick < 3; tick++) {
    await Promise.resolve();
  }
});
