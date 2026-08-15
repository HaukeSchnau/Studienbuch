import * as Schema_ from "effect/Schema";
import * as CalendarDate from "./calendar-date";

/**
 * A closed range of calendar dates. Both `start` and `end` belong to the range.
 * This is appropriate for school terms, validity windows, and multi-day tasks.
 */
export const Schema = Schema_.Struct({
  start: CalendarDate.Schema,
  end: CalendarDate.Schema,
}).check(
  Schema_.makeFilter(({ start, end }) => CalendarDate.compare(start, end) <= 0, {
    expected: "a closed calendar-date range whose start is not after its end",
  }),
);

export type Type = typeof Schema.Type;

export const contains = (range: Type, date: CalendarDate.Type): boolean =>
  CalendarDate.compare(range.start, date) <= 0 && CalendarDate.compare(date, range.end) <= 0;

export const encloses = (outer: Type, inner: Type): boolean =>
  CalendarDate.compare(outer.start, inner.start) <= 0 &&
  CalendarDate.compare(inner.end, outer.end) <= 0;

export const overlaps = (left: Type, right: Type): boolean =>
  CalendarDate.compare(left.start, right.end) <= 0 &&
  CalendarDate.compare(right.start, left.end) <= 0;

/** Number of dates in this inclusive range; a single-day range has length 1. */
export const lengthInDays = (range: Type): number =>
  CalendarDate.daysUntil(range.start, range.end) + 1;
