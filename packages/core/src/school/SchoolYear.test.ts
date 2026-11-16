import { describe, expect, it } from "@effect/vitest";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
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
    { day: "2027-08-01", year: "2027", half: 1 },
  ])("puts $day in half $half of $year", ({ day, year, half }) => {
    const around = SchoolYear.around(date(day));
    const holding = around.halves.findIndex((dates) => CivilTime.contains(dates, date(day)));

    expect([around.id, holding + 1]).toEqual([year, half]);
  });

  it("runs from August 1 to July 31, in halves that part on February 1", () => {
    const { row, halves } = SchoolYear.around(date("2026-10-29"));

    const text = (range: CivilTime.DateRange) =>
      `${PlainDateFns.toString(range.start)} ${PlainDateFns.toString(range.end)}`;

    expect([row.name, text(row.dates), ...halves.map(text)]).toEqual([
      "2026/27",
      "2026-08-01 2027-07-31",
      "2026-08-01 2027-01-31",
      "2027-02-01 2027-07-31",
    ]);
  });
});
