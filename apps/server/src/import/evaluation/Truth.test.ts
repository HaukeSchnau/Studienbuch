import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { TinySchool } from "./TinySchool.ts";
import { Truth } from "./Truth.ts";

describe("Truth", () => {
  // A Kurswahl lasts a term. A corpus without labelled terms, as corpus v1 is, would otherwise
  // hold a student's courses from one school year into the next.
  it.effect("splits each captured school year into halves at the capture plan's boundary", () =>
    Effect.gen(function* () {
      const { halves } = yield* Truth.build(TinySchool.corpus);

      assert.deepStrictEqual(halves, [
        { id: "2026/2027 1", start: "2026-08-13", end: "2027-01-31" },
        { id: "2026/2027 2", start: "2027-02-01", end: "2027-07-07" },
      ]);
    }),
  );
});
