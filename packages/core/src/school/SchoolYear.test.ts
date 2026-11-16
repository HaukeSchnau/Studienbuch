import { describe, expect, it } from "@effect/vitest";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { Fixture } from "../testing/Fixture.ts";
import { SchoolYear } from "./SchoolYear.ts";

const { date } = Fixture;

describe("SchoolYear.around", () => {
  it.each([
    { day: "2026-08-01", year: "2026", half: 1 },
    { day: "2027-01-31", year: "2026", half: 1 },
    { day: "2027-02-01", year: "2026", half: 2 },
    { day: "2027-07-31", year: "2026", half: 2 },
  ])("puts $day in half $half of $year", ({ day, year, half }) => {
    const around = SchoolYear.around(date(day));

    expect([around.id, around.current.number]).toEqual([year, half]);
    expect(CivilTime.contains(around.row.dates, date(day))).toBe(true);
  });
});
