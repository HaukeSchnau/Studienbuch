import * as Schema from "effect/Schema";

const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

const isValidCalendarDate = (value: string) => {
  const match = calendarDatePattern.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

export const CalendarDate = Schema.String.check(
  Schema.makeFilter(isValidCalendarDate, { expected: "a valid ISO calendar date (YYYY-MM-DD)" }),
).pipe(Schema.brand("CalendarDate"));
export type CalendarDate = typeof CalendarDate.Type;

export const LocalTime = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 24 * 60 - 1 }),
).pipe(Schema.brand("LocalTime"));
export type LocalTime = typeof LocalTime.Type;

export const PositiveMinutes = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 24 * 60 }),
).pipe(Schema.brand("PositiveMinutes"));
export type PositiveMinutes = typeof PositiveMinutes.Type;

export const Weekday = Schema.Literals([1, 2, 3, 4, 5, 6, 7]);
export type Weekday = typeof Weekday.Type;

export const DateInterval = Schema.Struct({
  start: CalendarDate,
  end: CalendarDate,
}).check(
  Schema.makeFilter(({ start, end }) => start <= end, {
    expected: "a closed date interval whose start is not after its end",
  }),
);
export interface DateInterval extends Schema.Schema.Type<typeof DateInterval> {}

export const TimeRange = Schema.Struct({
  start: LocalTime,
  end: LocalTime,
}).check(
  Schema.makeFilter(({ start, end }) => start < end, {
    expected: "a non-empty same-day half-open time range",
  }),
);
export interface TimeRange extends Schema.Schema.Type<typeof TimeRange> {}

const epochDay = (date: CalendarDate) => {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const utc = new Date(0);
  utc.setUTCHours(0, 0, 0, 0);
  utc.setUTCFullYear(year, month - 1, day);
  return Math.floor(utc.getTime() / 86_400_000);
};

const fromEpochDay = (day: number): CalendarDate => {
  const date = new Date(day * 86_400_000);
  return CalendarDate.make(date.toISOString().slice(0, 10));
};

export const compareCalendarDates = (left: CalendarDate, right: CalendarDate) =>
  left < right ? -1 : left > right ? 1 : 0;

export const addCalendarDays = (date: CalendarDate, days: number): CalendarDate =>
  fromEpochDay(epochDay(date) + days);

export const daysBetween = (start: CalendarDate, end: CalendarDate) =>
  epochDay(end) - epochDay(start);

export const containsDate = (interval: DateInterval, date: CalendarDate) =>
  interval.start <= date && date <= interval.end;

export const dateIntervalsOverlap = (left: DateInterval, right: DateInterval) =>
  left.start <= right.end && right.start <= left.end;

export const timeRangesOverlap = (left: TimeRange, right: TimeRange) =>
  left.start < right.end && right.start < left.end;

export const weekdayOf = (date: CalendarDate): Weekday => {
  const weekday = new Date(epochDay(date) * 86_400_000).getUTCDay();
  switch (weekday) {
    case 0:
      return 7;
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 5;
    default:
      return 6;
  }
};

export const isoWeek = (date: CalendarDate) => {
  const value = new Date(epochDay(date) * 86_400_000);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil(((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
};
