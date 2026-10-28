import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { setTimeout as sleep } from "node:timers/promises";

it("waits on the wall clock", async () => {
  // oxlint-disable-next-line studienbuch/no-real-time-wait-in-tests -- fixture: timers/promises in a test
  await sleep(10);
});

it("waits for a timer in a promise", async () => {
  await new Promise((resolve) => {
    // oxlint-disable-next-line studienbuch/no-real-time-wait-in-tests -- fixture: setTimeout in a promise executor
    setTimeout(resolve, 10);
  });
});

it.live("sleeps on the real clock", () =>
  // oxlint-disable-next-line studienbuch/no-real-time-wait-in-tests -- fixture: Effect.sleep under it.live
  Effect.sleep("10 millis"),
);

it.effect("sleeps on a TestClock nobody drives", () =>
  // oxlint-disable-next-line studienbuch/no-real-time-wait-in-tests -- fixture: an undriven TestClock
  Effect.sleep("10 millis"),
);
