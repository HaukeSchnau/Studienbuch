import { assert, describe, expect, it } from "@effect/vitest";
import * as Cron from "effect/Cron";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Option from "effect/Option";
import { ImportRun } from "../ImportRun.ts";
import { Lease } from "../Lease.ts";
import { IgsLilienthal } from "./IgsLilienthal.ts";
import { SchoolProfile } from "./SchoolProfile.ts";

const { Lasting, CohortWide, Collection } = SchoolProfile.Classification;

describe("IgsLilienthal", () => {
  it.each([
    { name: "11.2", is: Lasting({ gradeLevel: 11 }) },
    { name: "8.1", is: Lasting({ gradeLevel: 8 }) },
    { name: "12", is: CohortWide({ gradeLevel: 12 }) },
    { name: "13", is: CohortWide({ gradeLevel: 13 }) },
    { name: "12.1", is: CohortWide({ gradeLevel: 12 }) },
    // A grade below the upper school gathers its classes.
    { name: "8", is: Collection() },
    { name: "11", is: Collection() },
    { name: "14", is: Collection() },
    { name: "14.1", is: Collection() },
    { name: "0.1", is: Collection() },
    { name: "11.2 ", is: Collection() },
    { name: " 12", is: Collection() },
    { name: "١١.٢", is: Collection() },
    { name: "１２", is: Collection() },
    { name: "11/2", is: Collection() },
    { name: "Q1", is: Collection() },
    { name: "", is: Collection() },
  ])("classifies '$name'", ({ name, is }) => {
    assert.deepStrictEqual(IgsLilienthal.classify(name), is);
  });

  it.each([
    { classification: Lasting({ gradeLevel: 11 }), read: Option.some(11) },
    { classification: CohortWide({ gradeLevel: 13 }), read: Option.some(13) },
    { classification: Lasting({ gradeLevel: 10 }), read: Option.none() },
    { classification: Collection(), read: Option.none() },
  ])("reads $classification._tag classes of the upper school only", ({ classification, read }) => {
    assert.deepStrictEqual(
      SchoolProfile.gradeLevelRead(IgsLilienthal.profile, classification),
      read,
    );
  });

  // The phrase comes out in the profile's spelling, so the row never holds what WebUntis sent.
  it.each([
    { text: "Vertretung", phrase: Option.some("Vertretung") },
    { text: "  VERTRETUNG ", phrase: Option.some("Vertretung") },
    { text: "Raumänderung".normalize("NFD"), phrase: Option.some("Raumänderung") },
    { text: "Ｖｅｒｔｒｅｔｕｎｇ", phrase: Option.some("Vertretung") },
    { text: "eva", phrase: Option.some("EVA") },
    { text: "Vertretung für Wiebke", phrase: Option.none() },
    { text: "Vertretung: Raum 101", phrase: Option.none() },
    { text: "Vertretungs", phrase: Option.none() },
    { text: "", phrase: Option.none() },
  ])("reads '$text' as a stock phrase: $phrase", ({ text, phrase }) => {
    assert.deepStrictEqual(SchoolProfile.stockPhrase(IgsLilienthal.profile, text), phrase);
  });

  // A normal day, and the two on which the clocks change.
  it.each(["2026-11-02", "2026-03-29", "2026-10-25"])(
    "reserves within the cap on %s, and every run ends before midnight",
    (date) => {
      const { school } = IgsLilienthal.profile;
      const noon = DateTime.makeUnsafe(`${date}T12:00:00Z`);
      const start = ImportRun.endOfDay(school, DateTime.subtract(noon, { days: 1 }));
      const end = ImportRun.endOfDay(school, noon);

      const runs = Object.values(IgsLilienthal.schedule).map((run) => {
        const starts: Array<DateTime.Utc> = [];

        for (const next of Cron.sequence(run.cron, DateTime.subtract(start, { seconds: 1 }))) {
          const at = DateTime.makeUnsafe(next);

          if (!DateTime.isLessThan(at, end)) break;

          starts.push(at);
        }

        return { count: starts.length, maximum: run.maximum, last: starts.at(-1) };
      });

      const reserved = runs.reduce((sum, { count, maximum }) => sum + count * maximum, 0);

      const lastEnd = runs.flatMap(({ last }) =>
        last === undefined ? [] : [DateTime.addDuration(last, Lease.deadline)],
      );

      expect({
        runs: runs.map(({ count }) => count),
        reserved,
        fits: reserved <= ImportRun.dailyCap,
        beforeMidnight: lastEnd.every((at) =>
          DateTime.isLessThan(at, DateTime.subtractDuration(end, Duration.minutes(1))),
        ),
      }).toEqual({ runs: [96, 1], reserved: 2796, fits: true, beforeMidnight: true });
    },
  );
});
