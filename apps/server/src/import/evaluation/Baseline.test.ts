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
    runs: [{ total: 2, failed: 0 }],
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
      expected: [{ number: "weekly.passingCases.1", baseline: "nothing", measured: '"free-day"' }],
    },
    {
      name: "nothing in a list of objects whose fields come in another order",
      committed: { ...measured, weekly: { ...measured.weekly, runs: [{ failed: 0, total: 2 }] } },
      expected: [],
    },
    {
      name: "a field that moved inside a list",
      committed: { ...measured, weekly: { ...measured.weekly, runs: [{ total: 2, failed: 1 }] } },
      expected: [{ number: "weekly.runs.0.failed", baseline: "1", measured: "0" }],
    },
    {
      name: "a list written as an object with numbered fields",
      committed: {
        ...measured,
        weekly: { ...measured.weekly, passingCases: { 0: "cancellation", 1: "free-day" } },
      },
      expected: [
        {
          number: "weekly.passingCases",
          baseline: '{"0":"cancellation","1":"free-day"}',
          measured: '["cancellation","free-day"]',
        },
      ],
    },
    {
      name: "a number the file lacks, and one it still has",
      committed: {
        corpus: "capture",
        weekly: {
          views: measured.weekly.views,
          passingCases: measured.weekly.passingCases,
          runs: measured.weekly.runs,
        },
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
          baseline: '{"right":28,"of":28,"rounded":1}',
          measured: "28 of 28",
        },
      ],
    },
    {
      name: "a number moved to a key that spells its path",
      committed: {
        corpus: "capture",
        weekly: {
          views: measured.weekly.views,
          passingCases: measured.weekly.passingCases,
          runs: measured.weekly.runs,
        },
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
    {
      name: "a list written as one text that reads like it",
      committed: {
        ...measured,
        weekly: { ...measured.weekly, passingCases: ['cancellation", "free-day'] },
      },
      expected: [
        {
          number: "weekly.passingCases.0",
          baseline: '"cancellation\\", \\"free-day"',
          measured: '"cancellation"',
        },
        { number: "weekly.passingCases.1", baseline: "nothing", measured: '"free-day"' },
      ],
    },
    {
      name: "a field named like the prototype",
      committed: { ...measured, ...Object.fromEntries([["__proto__", {}]]) },
      expected: [{ number: "__proto__", baseline: "{}", measured: "nothing" }],
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
