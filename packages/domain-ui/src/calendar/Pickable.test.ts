import { assert, describe, it } from "@effect/vitest";
import { CivilTime } from "@stu/core";
import * as Schema from "effect/Schema";

import { Pickable } from "./Pickable.ts";

const date = Schema.decodeSync(CivilTime.PlainDate);
const range = { start: date("2026-11-17"), end: date("2027-11-17") };

// An edit whose homework was due before today: the date it had stays pickable after the student
// tried another one, and no other past day does.
describe("Pickable", () => {
  const days: Pickable.Days = { range, kept: date("2026-10-30") };

  it.each([
    ["the kept day", "2026-10-30", true],
    ["the day after it", "2026-10-31", false],
    ["yesterday", "2026-11-16", false],
    ["today", "2026-11-17", true],
  ])("%s", (_, day, pickable) => {
    assert.strictEqual(Pickable.contains(days, date(day)), pickable);
  });

  it("pages back to the kept day's month", () => {
    assert.deepStrictEqual(Pickable.reach(days), { start: date("2026-10-30"), end: range.end });
    assert.deepStrictEqual(Pickable.reach({ range }), range);
  });
});
