import { describe, expect, it } from "@effect/vitest";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { School } from "./School.ts";

describe("School.now", () => {
  const berlin = { timeZone: School.defaultTimeZone };
  const newYork = { timeZone: CivilTime.TimeZone.make("America/New_York") };

  const clock = (time: number) => {
    const minutes = time / 60_000;

    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  };

  it.each([
    {
      name: "the evening before midnight",
      school: berlin,
      at: "2026-11-18T22:59:00Z",
      now: "2026-11-18 23:59",
    },
    {
      name: "the next day from midnight",
      school: berlin,
      at: "2026-11-18T23:00:00Z",
      now: "2026-11-19 00:00",
    },
    {
      name: "the default zone without a row",
      school: undefined,
      at: "2026-11-18T23:00:00Z",
      now: "2026-11-19 00:00",
    },
    // Berlin is already on the 19th, so the date follows the school, not the device.
    {
      name: "the school's evening where the device is past midnight",
      school: newYork,
      at: "2026-11-19T03:30:00Z",
      now: "2026-11-18 22:30",
    },
    {
      name: "the last minute before the clocks go forward",
      school: berlin,
      at: "2026-03-29T00:59:00Z",
      now: "2026-03-29 01:59",
    },
    {
      name: "the first minute after the clocks go forward",
      school: berlin,
      at: "2026-03-29T01:00:00Z",
      now: "2026-03-29 03:00",
    },
    {
      name: "midnight an hour earlier in UTC after the clocks go forward",
      school: berlin,
      at: "2026-03-29T22:00:00Z",
      now: "2026-03-30 00:00",
    },
    {
      name: "the first 02:30 when the clocks go back",
      school: berlin,
      at: "2026-10-25T00:30:00Z",
      now: "2026-10-25 02:30",
    },
    {
      name: "the second 02:30 when the clocks go back",
      school: berlin,
      at: "2026-10-25T01:30:00Z",
      now: "2026-10-25 02:30",
    },
    {
      name: "08:00 an hour later in UTC after the clocks go back",
      school: berlin,
      at: "2026-10-25T07:00:00Z",
      now: "2026-10-25 08:00",
    },
    {
      name: "the same day until its midnight after the clocks go back",
      school: berlin,
      at: "2026-10-25T22:59:00Z",
      now: "2026-10-25 23:59",
    },
  ])("is $now at $at for $name", ({ school, at, now }) => {
    const instant = Date.parse(at);
    const shown = School.now(school, instant);

    expect([`${CivilTime.format(shown.date)} ${clock(shown.time)}`, shown.at]).toEqual([
      now,
      instant,
    ]);
    expect(CivilTime.format(School.today(school, instant))).toBe(now.slice(0, 10));
  });
});
