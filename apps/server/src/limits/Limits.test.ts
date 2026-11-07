import { assert, describe, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as TestClock from "effect/testing/TestClock";
import { Limits } from "./Limits.ts";

/** A map that counts the entries its loops visit, which is what a count costs. */
class Visited extends Map<string, Limits.Count> {
  visits = 0;

  override [Symbol.iterator]() {
    const entries = super[Symbol.iterator]();
    const next = entries.next.bind(entries);

    entries.next = () => {
      const step = next();

      if (step.done !== true) this.visits += 1;

      return step;
    };

    return entries;
  }
}

const countMany = (limits: ReturnType<typeof Limits.make>, prefix: string, amount: number) =>
  Effect.map(Clock.currentTimeMillis, (now) => {
    for (let index = 0; index < amount; index += 1) limits.add(`${prefix} ${index}`, now);
  });

describe("Limits", () => {
  it.effect("a count looks at one key, however many keys the counter holds", () =>
    Effect.gen(function* () {
      const counts = new Visited();
      const limits = Limits.make("15 minutes", counts);

      yield* countMany(limits, "client", 100_000);
      counts.visits = 0;
      yield* TestClock.adjust("1 minute");
      yield* countMany(limits, "later", 1000);
      const whileLive = counts.visits;

      // The first count after the window removes every key of it, once.
      yield* TestClock.adjust("15 minutes");
      yield* countMany(limits, "next window", 1);
      const left = counts.size;

      counts.visits = 0;
      yield* countMany(limits, "next", 1000);

      assert.deepStrictEqual(
        { whileLive, left, afterwards: counts.visits },
        { whileLive: 1000, left: 1, afterwards: 1000 },
      );
    }),
  );

  it.effect("keeps its keys in the order their windows end", () =>
    Effect.gen(function* () {
      const counts = new Visited();
      const limits = Limits.make("15 minutes", counts);

      yield* countMany(limits, "a", 1);
      yield* TestClock.adjust("1 minute");
      yield* countMany(limits, "b", 1);

      // a's window is over, b's isn't: a starts a new one, which ends after b's.
      yield* TestClock.adjust("14 minutes");
      yield* countMany(limits, "a", 1);
      const afterA = Array.from(counts.keys());

      yield* TestClock.adjust("1 minute");
      yield* countMany(limits, "c", 1);

      assert.deepStrictEqual(
        { afterA, afterC: Array.from(counts.keys()) },
        { afterA: ["b 0", "a 0"], afterC: ["a 0", "c 0"] },
      );
    }),
  );
});
