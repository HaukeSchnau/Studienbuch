import { describe, expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { Fixture } from "../testing/Fixture.ts";
import { Term } from "./Term.ts";

const { date } = Fixture;

const terms = [
  {
    id: "winter",
    row: {
      schoolYearId: Fixture.schoolYear,
      name: "Winter",
      dates: { start: date("2026-08-01"), end: date("2027-01-31") },
    },
  },
  {
    id: "summer",
    row: {
      schoolYearId: Fixture.schoolYear,
      name: "Sommer",
      dates: { start: date("2027-02-01"), end: date("2027-07-31") },
    },
  },
];

describe("Term.containing", () => {
  it.each([
    { day: "2026-08-01", term: "winter" },
    { day: "2027-01-31", term: "winter" },
    { day: "2027-02-01", term: "summer" },
    { day: "2027-08-01", term: undefined },
  ])("puts $day in $term, counting both ends of a term", ({ day, term }) => {
    expect(Option.getOrUndefined(Term.containing(terms, date(day)))?.id).toBe(term);
  });
});
