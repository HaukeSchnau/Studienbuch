import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Baseline } from "./Baseline.ts";

const json = Schema.decodeUnknownEffect(Schema.Json);

const measured = {
  corpus: "capture",
  weekly: {
    views: { student: { recall: { right: 28, of: 28 } } },
    passingCases: ["cancellation", "free-day"],
    hiddenDays: 0,
  },
};

describe("Baseline", () => {
  it.effect.each([
    { name: "the same numbers", committed: measured, expected: [] },
    {
      name: "a fraction that moved",
      committed: {
        ...measured,
        weekly: { ...measured.weekly, views: { student: { recall: { right: 27, of: 28 } } } },
      },
      expected: [
        { number: "weekly.views.student.recall", baseline: "27 of 28", measured: "28 of 28" },
      ],
    },
    {
      name: "a case that passes now",
      committed: { ...measured, weekly: { ...measured.weekly, passingCases: ["cancellation"] } },
      expected: [
        {
          number: "weekly.passingCases",
          baseline: '["cancellation"]',
          measured: '["cancellation", "free-day"]',
        },
      ],
    },
    {
      name: "a number the file lacks, and one it still has",
      committed: {
        corpus: "capture",
        weekly: { views: measured.weekly.views, passingCases: measured.weekly.passingCases },
        retired: 4,
      },
      expected: [
        { number: "weekly.hiddenDays", baseline: "nothing", measured: "0" },
        { number: "retired", baseline: "4", measured: "nothing" },
      ],
    },
    {
      name: "a number written as text",
      committed: { ...measured, weekly: { ...measured.weekly, hiddenDays: "0" } },
      expected: [{ number: "weekly.hiddenDays", baseline: '"0"', measured: "0" }],
    },
    {
      name: "a fraction with a field more",
      committed: {
        ...measured,
        weekly: {
          ...measured.weekly,
          views: { student: { recall: { right: 28, of: 28, rounded: 1 } } },
        },
      },
      expected: [
        {
          number: "weekly.views.student.recall",
          baseline: "{right, of, rounded}",
          measured: "28 of 28",
        },
      ],
    },
    {
      name: "a number moved to a key that spells its path",
      committed: {
        corpus: "capture",
        weekly: { views: measured.weekly.views, passingCases: measured.weekly.passingCases },
        "weekly.hiddenDays": 0,
      },
      expected: [
        { number: "weekly.hiddenDays", baseline: "nothing", measured: "0" },
        { number: "weekly.hiddenDays", baseline: "0", measured: "nothing" },
      ],
    },
    {
      name: "an empty object more",
      committed: { ...measured, retired: {} },
      expected: [{ number: "retired", baseline: "{}", measured: "nothing" }],
    },
  ])("finds $name", ({ committed, expected }) =>
    Effect.gen(function* () {
      assert.deepStrictEqual(
        Baseline.differences(yield* json(committed), yield* json(measured)),
        expected,
      );
    }),
  );
});
