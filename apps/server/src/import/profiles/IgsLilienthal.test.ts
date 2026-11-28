import { assert, describe, expect, it } from "@effect/vitest";
import * as Cron from "effect/Cron";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Option from "effect/Option";
import { Export } from "../corpus/Export.ts";
import { ImportJob } from "../ImportJob.ts";
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

  // Eight weeks across the spring and the autumn change of the clocks.
  it.each(["2026-03-16", "2026-10-12"])(
    "exports once a week from %s on, Mondays at 00:30, while no run reads or writes the store",
    (date) => {
      const { timeZone } = IgsLilienthal.profile.school;
      const from = DateTime.makeUnsafe(`${date}T00:00:00Z`);

      const startsOf = (cron: Cron.Cron, until: DateTime.Utc) => {
        const starts: Array<DateTime.Utc> = [];

        for (const next of Cron.sequence(cron, DateTime.subtract(from, { days: 1 }))) {
          const at = DateTime.makeUnsafe(next);

          if (!DateTime.isLessThan(at, until)) break;

          starts.push(at);
        }

        return starts;
      };

      const slots = startsOf(IgsLilienthal.weeklyExport, DateTime.add(from, { weeks: 8 })).filter(
        (slot) => !DateTime.isLessThan(slot, from),
      );

      const runs = Object.values(IgsLilienthal.schedule).flatMap((run) =>
        startsOf(run.cron, DateTime.add(from, { weeks: 9 })),
      );

      // A run reads and stores until its deadline; an export gets an hour.
      const clashes = slots.filter((slot) =>
        runs.some(
          (start) =>
            DateTime.isLessThan(slot, DateTime.addDuration(start, ImportJob.deadline)) &&
            DateTime.isLessThan(start, DateTime.add(slot, { hours: 1 })),
        ),
      );

      const local = slots.map((slot) => {
        const parts = DateTime.toParts(DateTime.makeZonedUnsafe(slot, { timeZone }));

        return `${parts.weekDay} ${parts.hour}:${parts.minute}`;
      });

      // On time, the store still holds everything each week can need.
      const held = slots.every((slot) =>
        Export.holds(timeZone, DateTime.subtract(slot, { days: Export.days }), slot),
      );

      expect({ local, clashes, held }).toEqual({
        local: Array(8).fill("1 0:30"),
        clashes: [],
        held: true,
      });
    },
  );
});
