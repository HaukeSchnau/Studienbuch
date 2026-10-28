import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

const days = ["Montag", "Dienstag"];

for (const day of days) {
  // oxlint-disable-next-line studienbuch/no-test-in-loop -- fixture: a test per loop iteration
  it(`plans ${day}`, () => undefined);
}

describe("each day", () => {
  for (const day of days) {
    // oxlint-disable-next-line studienbuch/no-test-in-loop -- fixture: it.effect in a loop
    it.effect(day, () => Effect.void);
  }
});

it.each(days)("plans %s", () => undefined);
