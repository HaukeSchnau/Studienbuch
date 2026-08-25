import { describe, expect, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import type { Schoolyear } from "webuntis-api";
import { defaultPolicy, pollingWindows, type Policy } from "./polling-policy.ts";

const academicYear: Schoolyear = {
  id: 10,
  name: "2026/2027",
  dateRange: { start: "2026-08-13", end: "2027-07-07" },
};

describe("WebUntis polling policy", () => {
  it("keeps the ten-minute and hourly timetable windows disjoint", () => {
    expect(pollingWindows("2026-08-25", academicYear)).toEqual({
      recentAndNearTimetable: {
        schoolYear: "2026/2027",
        start: "2026-08-23",
        end: "2026-09-08",
      },
      farTimetable: {
        schoolYear: "2026/2027",
        start: "2026-09-09",
        end: "2026-10-20",
      },
      courseRosters: {
        schoolYear: "2026/2027",
        start: "2026-08-13",
        end: "2026-09-22",
      },
    });
  });

  it("clips every source window to the provider school year", () => {
    expect(pollingWindows("2027-07-01", academicYear)).toEqual({
      recentAndNearTimetable: {
        schoolYear: "2026/2027",
        start: "2027-06-29",
        end: "2027-07-07",
      },
      farTimetable: undefined,
      courseRosters: {
        schoolYear: "2026/2027",
        start: "2027-06-03",
        end: "2027-07-07",
      },
    });
  });

  it("allows short deterministic cadences without changing range policy", () => {
    const testPolicy: Policy = {
      ...defaultPolicy,
      directoryInterval: Duration.seconds(4),
      recentAndNearTimetableInterval: Duration.seconds(1),
      farTimetableInterval: Duration.seconds(2),
      courseRosterInterval: Duration.seconds(3),
      retryBaseDelay: Duration.millis(10),
      jitter: false,
    };
    expect(Duration.toMillis(testPolicy.recentAndNearTimetableInterval)).toBe(1_000);
    expect(pollingWindows("2026-08-25", academicYear, testPolicy)).toEqual(
      pollingWindows("2026-08-25", academicYear),
    );
  });
});
