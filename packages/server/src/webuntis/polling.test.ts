import { describe, expect, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { TestClock } from "effect/testing";
import type { SchoolyearWithTimeGrid } from "webuntis-api";
import { WebUntisImporter } from "./importer.ts";
import { run } from "./polling.ts";
import { defaultPolicy, type Policy } from "./polling-policy.ts";

const academicYear: SchoolyearWithTimeGrid = {
  id: 10,
  name: "2026/2027",
  dateRange: { start: "2026-08-13", end: "2027-07-07" },
  timeGrid: { schoolyearId: 10, units: [] },
};

const policy: Policy = {
  ...defaultPolicy,
  directoryInterval: Duration.seconds(4),
  recentAndNearTimetableInterval: Duration.seconds(1),
  farTimetableInterval: Duration.seconds(2),
  courseRosterInterval: Duration.seconds(3),
  retryBaseDelay: Duration.millis(10),
  retryCount: 1,
  jitter: false,
};

type ImportCall =
  | { readonly dataset: "directory"; readonly schoolYear: string }
  | {
      readonly dataset: "timetable" | "course-rosters";
      readonly schoolYear: string;
      readonly start: string;
      readonly end: string;
    };

const directorySummary: WebUntisImporter.DirectoryImportSummary = {
  dataSourceId: "webuntis:school",
  schoolYear: academicYear.name,
  sourceChanged: false,
  projectionChanged: true,
  changeCount: 0,
};

const timetableSummary: WebUntisImporter.TimetableImportSummary = {
  dataSourceId: "webuntis:school",
  schoolYear: academicYear.name,
  scopeCount: 1,
  completeScopeCount: 1,
  sourceChangedScopeCount: 0,
  projectionChangedScopeCount: 0,
  changeCount: 0,
};

const courseRosterSummary: WebUntisImporter.CourseRosterImportSummary = {
  dataSourceId: "webuntis:school",
  schoolYear: academicYear.name,
  scopeCount: 1,
  sourceChangedScopeCount: 0,
  annualObservationCount: 0,
  resolvedObservationCount: 0,
  unresolvedObservationCount: 0,
  createdOfferingCount: 0,
  changedCount: 0,
};

const service = (
  calls: Array<ImportCall>,
  timetable: WebUntisImporter.Service["Service"]["importTimetable"] = (schoolYear, start, end) =>
    Effect.sync(() => {
      calls.push({ dataset: "timetable", schoolYear, start, end });
      return timetableSummary;
    }),
): WebUntisImporter.Service["Service"] => ({
  currentSchoolYear: Effect.succeed(academicYear),
  importDirectory: (schoolYear) =>
    Effect.sync(() => {
      calls.push({ dataset: "directory", schoolYear });
      return directorySummary;
    }),
  importTimetable: timetable,
  importCourseRosters: (schoolYear, start, end) =>
    Effect.sync(() => {
      calls.push({ dataset: "course-rosters", schoolYear, start, end });
      return courseRosterSummary;
    }),
});

const awaitCalls = (calls: ReadonlyArray<ImportCall>, count: number) =>
  Effect.gen(function* () {
    while (calls.length < count) yield* Effect.yieldNow;
  });

describe("WebUntis polling worker", () => {
  it.effect("runs every source at startup and then follows its own cadence", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse("2026-08-25T10:00:00Z"));
      const calls: Array<ImportCall> = [];
      const fiber = yield* run(policy).pipe(
        Effect.provideService(WebUntisImporter.Service, service(calls)),
        Effect.forkChild,
      );

      yield* awaitCalls(calls, 4);
      expect(calls).toEqual([
        { dataset: "directory", schoolYear: "2026/2027" },
        {
          dataset: "timetable",
          schoolYear: "2026/2027",
          start: "2026-08-23",
          end: "2026-09-08",
        },
        {
          dataset: "timetable",
          schoolYear: "2026/2027",
          start: "2026-09-09",
          end: "2026-10-20",
        },
        {
          dataset: "course-rosters",
          schoolYear: "2026/2027",
          start: "2026-08-13",
          end: "2026-09-22",
        },
      ]);

      yield* TestClock.adjust(Duration.millis(999));
      expect(calls).toHaveLength(4);
      yield* TestClock.adjust(Duration.millis(1));
      yield* awaitCalls(calls, 5);
      expect(calls.filter((call) => call.dataset === "timetable")).toHaveLength(3);

      yield* TestClock.adjust(Duration.seconds(1));
      yield* awaitCalls(calls, 7);
      expect(calls.filter((call) => call.dataset === "timetable")).toHaveLength(5);
      yield* Fiber.interrupt(fiber);
    }),
  );

  it.effect("refreshes course evidence after a scheduled directory change", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse("2026-08-25T10:00:00Z"));
      const calls: Array<ImportCall> = [];
      const directoryPolicy: Policy = {
        ...policy,
        directoryInterval: Duration.seconds(1),
        recentAndNearTimetableInterval: Duration.hours(1),
        farTimetableInterval: Duration.hours(1),
        courseRosterInterval: Duration.hours(1),
      };
      const fiber = yield* run(directoryPolicy).pipe(
        Effect.provideService(WebUntisImporter.Service, service(calls)),
        Effect.forkChild,
      );

      yield* awaitCalls(calls, 4);
      yield* TestClock.adjust(Duration.seconds(1));
      yield* awaitCalls(calls, 6);
      expect(calls.slice(-2).map((call) => call.dataset)).toEqual(["directory", "course-rosters"]);
      yield* Fiber.interrupt(fiber);
    }),
  );

  it.effect("continues on the normal cadence after an import exhausts its retries", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.parse("2026-08-25T10:00:00Z"));
      const calls: Array<ImportCall> = [];
      let nearAttempts = 0;
      const timetable: WebUntisImporter.Service["Service"]["importTimetable"] = (
        schoolYear,
        start,
        end,
      ) =>
        Effect.suspend(() => {
          calls.push({ dataset: "timetable", schoolYear, start, end });
          if (start === "2026-08-23" && nearAttempts++ < 2) {
            return Effect.fail(
              WebUntisImporter.ImportAlreadyRunning.make({ dataset: "timetable" }),
            );
          }
          return Effect.succeed(timetableSummary);
        });
      const fiber = yield* run(policy).pipe(
        Effect.provideService(WebUntisImporter.Service, service(calls, timetable)),
        Effect.forkChild,
      );

      yield* awaitCalls(calls, 2);
      yield* TestClock.adjust(Duration.millis(10));
      yield* awaitCalls(calls, 5);
      expect(nearAttempts).toBe(2);

      yield* TestClock.adjust(Duration.seconds(1));
      yield* awaitCalls(calls, 6);
      expect(nearAttempts).toBe(3);
      yield* Fiber.interrupt(fiber);
    }),
  );
});
