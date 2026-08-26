import * as Duration from "effect/Duration";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import type { Schoolyear } from "@schnau/webuntis-api";

export interface PollingRange {
  readonly schoolYear: string;
  readonly start: string;
  readonly end: string;
}

export interface PollingWindows {
  readonly recentAndNearTimetable: PollingRange | undefined;
  readonly farTimetable: PollingRange | undefined;
  readonly courseRosters: PollingRange | undefined;
}

export interface Policy {
  readonly timeZone: string;
  readonly recentTimetableDays: number;
  readonly nearTimetableDays: number;
  readonly farTimetableDays: number;
  readonly courseRosterPastDays: number;
  readonly courseRosterFutureDays: number;
  readonly directoryInterval: Duration.Duration;
  readonly recentAndNearTimetableInterval: Duration.Duration;
  readonly farTimetableInterval: Duration.Duration;
  readonly courseRosterInterval: Duration.Duration;
  readonly retryBaseDelay: Duration.Duration;
  readonly retryCount: number;
  readonly jitter: boolean;
}

export const defaultPolicy: Policy = {
  timeZone: "Europe/Berlin",
  recentTimetableDays: 2,
  nearTimetableDays: 14,
  farTimetableDays: 56,
  courseRosterPastDays: 28,
  courseRosterFutureDays: 28,
  directoryInterval: Duration.days(1),
  recentAndNearTimetableInterval: Duration.minutes(10),
  farTimetableInterval: Duration.hours(1),
  courseRosterInterval: Duration.days(1),
  retryBaseDelay: Duration.seconds(5),
  retryCount: 2,
  jitter: true,
};

const offsetDate = (today: PlainDate.Record, days: number) =>
  PlainDate.toString(PlainDate.addDays(today, days));

const clipRange = (
  schoolYear: Schoolyear,
  requestedStart: string,
  requestedEnd: string,
): PollingRange | undefined => {
  const start =
    requestedStart < schoolYear.dateRange.start ? schoolYear.dateRange.start : requestedStart;
  const end = requestedEnd > schoolYear.dateRange.end ? schoolYear.dateRange.end : requestedEnd;
  return start > end ? undefined : { schoolYear: schoolYear.name, start, end };
};

/** Computes disjoint timetable windows and the slower private roster window for one local day. */
export const pollingWindows = (
  todayIso: string,
  schoolYear: Schoolyear,
  policy: Policy = defaultPolicy,
): PollingWindows => {
  const today = PlainDate.fromString(todayIso, Calendar.getBasic);
  return {
    recentAndNearTimetable: clipRange(
      schoolYear,
      offsetDate(today, -policy.recentTimetableDays),
      offsetDate(today, policy.nearTimetableDays),
    ),
    farTimetable: clipRange(
      schoolYear,
      offsetDate(today, policy.nearTimetableDays + 1),
      offsetDate(today, policy.farTimetableDays),
    ),
    courseRosters: clipRange(
      schoolYear,
      offsetDate(today, -policy.courseRosterPastDays),
      offsetDate(today, policy.courseRosterFutureDays),
    ),
  };
};

export * as WebUntisPollingPolicy from "./polling-policy.ts";
