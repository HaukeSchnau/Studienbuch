import { describe, expect, it } from "@effect/vitest";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { School } from "./School.ts";

describe("School.now", () => {
  const berlin = { timeZone: School.defaultTimeZone };
  const newYork = { timeZone: CivilTime.TimeZone.make("America/New_York") };

  /** "2026-11-17 00:00 Europe/Berlin": the date and the minute on the school's clock, and its zone. */
  const shown = (now: School.Now) => {
    const minutes = Math.floor(now.time / 60_000);
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");

    return `${CivilTime.format(now.date)} ${hh}:${mm} ${now.timeZone}`;
  };

  // The rows hold for a device in any zone: core never reads the device's.
  it.each([
    {
      name: "keeps the day until midnight on the school's clock",
      school: berlin,
      at: "2026-11-16T22:59:59.999Z",
      now: "2026-11-16 23:59 Europe/Berlin",
    },
    {
      name: "moves on to the next day at midnight on the school's clock",
      school: berlin,
      at: "2026-11-16T23:00:00.000Z",
      now: "2026-11-17 00:00 Europe/Berlin",
    },
    {
      name: "is still the evening before at a school in New York at that instant",
      school: newYork,
      at: "2026-11-16T23:00:00.000Z",
      now: "2026-11-16 18:00 America/New_York",
    },
    {
      name: "counts in Berlin on a device that holds no school row yet",
      school: undefined,
      at: "2026-11-16T23:00:00.000Z",
      now: "2026-11-17 00:00 Europe/Berlin",
    },
    {
      name: "skips from 02:00 to 03:00 the day the clocks go forward",
      school: berlin,
      at: "2027-03-28T01:00:00.000Z",
      now: "2027-03-28 03:00 Europe/Berlin",
    },
    {
      name: "reaches midnight an hour earlier after the clocks went forward",
      school: berlin,
      at: "2027-03-28T22:00:00.000Z",
      now: "2027-03-29 00:00 Europe/Berlin",
    },
    {
      name: "shows 02:00 a second time the day the clocks go back",
      school: berlin,
      at: "2026-10-25T01:00:00.000Z",
      now: "2026-10-25 02:00 Europe/Berlin",
    },
    {
      name: "keeps the day the clocks went back until its own midnight",
      school: berlin,
      at: "2026-10-25T22:59:59.999Z",
      now: "2026-10-25 23:59 Europe/Berlin",
    },
  ])("$name", ({ school, at, now }) => {
    expect(shown(School.now(school, Date.parse(at)))).toBe(now);
  });
});
