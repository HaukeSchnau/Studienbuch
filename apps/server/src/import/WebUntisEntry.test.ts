import type { TimetableEntry } from "@schnau/webuntis-api/schemas";
import { assert, describe, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { WebUntisEntry } from "./WebUntisEntry.ts";

const position = (type: string, status: string, shortName: string) => ({
  type,
  status,
  shortName,
  longName: shortName,
  displayName: shortName,
  displayNameLabel: null,
});

const entry = (changes: Partial<TimetableEntry>): TimetableEntry => ({
  ids: [2, 1],
  duration: { start: "2026-11-09T08:00", end: "2026-11-09T09:20" },
  type: "NORMAL_TEACHING_PERIOD",
  status: "REGULAR",
  layoutStartPosition: 0,
  layoutWidth: 1000,
  layoutGroup: 0,
  color: "#ffffff",
  notesAll: null,
  icons: [],
  position1: null,
  position2: null,
  position3: null,
  position4: null,
  texts: [],
  lessonText: null,
  lessonInfo: null,
  substitutionText: null,
  ...changes,
});

// The truth and every import read entries through this module, so a misreading would hide from
// the harness: both sides would agree on it.
describe("WebUntisEntry", () => {
  it("reads a substitution's teachers by type, whatever the position", () => {
    const substituted = entry({
      position1: null,
      position2: [{ current: position("SUBJECT", "REGULAR", "MA"), removed: null }],
      position3: [
        {
          current: position("TEACHER", "ADDED", "LE"),
          removed: position("TEACHER", "REMOVED", "LB"),
        },
        { current: position("TEACHER", "REGULAR", "LA"), removed: null },
      ],
    });

    assert.deepStrictEqual(
      {
        teachers: WebUntisEntry.names(substituted, "TEACHER"),
        subjects: WebUntisEntry.names(substituted, "SUBJECT"),
        rooms: WebUntisEntry.names(substituted, "ROOM"),
        ids: WebUntisEntry.ids(substituted),
      },
      {
        // The plan has the teacher the substitute replaced, not the substitute.
        teachers: { current: ["LA", "LE"], removed: ["LB"], planned: ["LA", "LB"] },
        subjects: { current: ["MA"], removed: [], planned: ["MA"] },
        rooms: { current: [], removed: [], planned: [] },
        ids: [1, 2],
      },
    );
  });

  it.each([
    { status: "REGULAR", reads: "Regular" },
    { status: "CHANGED", reads: "Changed" },
    { status: "CANCELLED", reads: "Cancelled" },
    { status: "ADDITIONAL", reads: "Added" },
    { status: "TROTZ_ABSENZ", reads: "Changed" },
  ])("reads $status as $reads", ({ status, reads }) => {
    assert.strictEqual(WebUntisEntry.status(entry({ status })), reads);
  });

  it.each([
    { text: "08:00", millis: Option.some(28_800_000) },
    { text: "2026-11-09T13:50", millis: Option.some(49_800_000) },
    { text: "2026-11-09T13:50:30", millis: Option.some(49_830_000) },
    { text: "1350", millis: Option.none() },
    { text: "2026-11-09T99:99", millis: Option.none() },
    { text: "2026-11-09T24:00", millis: Option.none() },
    { text: "2026-11-09T13:50:60", millis: Option.none() },
    { text: "2026-11-09T١٣:٥٠", millis: Option.none() },
  ])("reads $text as a time of day", ({ text, millis }) => {
    assert.deepStrictEqual(WebUntisEntry.timeOfDay(text), millis);
  });
});
