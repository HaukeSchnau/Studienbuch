import * as Schema_ from "effect/Schema";
import { PlainDateSchema } from "./plain-date";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";

/**
 * A closed range of calendar dates. Both `start` and `end` belong to the range.
 * This is appropriate for school terms, validity windows, and multi-day tasks.
 */
export const Schema = Schema_.Struct({
  start: PlainDateSchema,
  end: PlainDateSchema,
}).check(
  Schema_.makeFilter(({ start, end }) => PlainDate.compare(start, end) <= 0, {
    expected: "a closed calendar-date range whose start is not after its end",
  }),
);

export type Type = typeof Schema.Type;

export const contains = (range: Type, date: PlainDate.Record): boolean =>
  PlainDate.compare(range.start, date) <= 0 && PlainDate.compare(date, range.end) <= 0;

export const encloses = (outer: Type, inner: Type): boolean =>
  PlainDate.compare(outer.start, inner.start) <= 0 && PlainDate.compare(inner.end, outer.end) <= 0;

export const overlaps = (left: Type, right: Type): boolean =>
  PlainDate.compare(left.start, right.end) <= 0 && PlainDate.compare(right.start, left.end) <= 0;

/** Number of dates in this inclusive range; a single-day range has length 1. */
export const lengthInDays = (range: Type): number => PlainDate.diffDays(range.start, range.end) + 1;

export * as CalendarDateRange from "./calendar-date-range";
