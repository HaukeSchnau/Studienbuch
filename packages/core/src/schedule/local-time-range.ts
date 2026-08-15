import * as Duration from "effect/Duration";
import * as Schema_ from "effect/Schema";
import * as LocalTime from "./local-time";

/**
 * A non-empty half-open interval `[start, end)` within one local calendar day.
 *
 * The end is exclusive, so adjacent periods do not overlap. `24:00` cannot be
 * represented by LocalTime; overnight and end-of-day intervals require an
 * explicit date-aware concept rather than a sentinel wall-clock time.
 */
export const Schema = Schema_.Struct({
  start: LocalTime.Schema,
  end: LocalTime.Schema,
}).check(
  Schema_.makeFilter(({ start, end }) => LocalTime.compare(start, end) < 0, {
    expected: "a non-empty same-day half-open local-time range",
  }),
);

export type Type = typeof Schema.Type;

export const contains = (range: Type, time: LocalTime.Type): boolean =>
  LocalTime.compare(range.start, time) <= 0 && LocalTime.compare(time, range.end) < 0;

export const overlaps = (left: Type, right: Type): boolean =>
  LocalTime.compare(left.start, right.end) < 0 && LocalTime.compare(right.start, left.end) < 0;

/** Returns the elapsed wall-clock duration between the two same-day endpoints. */
export const duration = (range: Type): Duration.Duration =>
  Duration.millis(LocalTime.toMilliseconds(range.end) - LocalTime.toMilliseconds(range.start));
