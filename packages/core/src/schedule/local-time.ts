import * as Equivalence_ from "effect/Equivalence";
import * as Option from "effect/Option";
import * as Order_ from "effect/Order";
import * as Schema_ from "effect/Schema";

const millisecondsPerSecond = 1_000;
const millisecondsPerMinute = 60 * millisecondsPerSecond;
const millisecondsPerHour = 60 * millisecondsPerMinute;
const lastMillisecondOfDay = 24 * millisecondsPerHour - 1;
const localTimePattern = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?$/;

/**
 * A wall-clock time within one local calendar day, with millisecond precision.
 *
 * This value has no date, timezone, or UTC offset. Its encoded representation is
 * the number of milliseconds since 00:00:00.000. Because 24:00 belongs to the
 * following day, the largest valid value is 23:59:59.999.
 */
export const Schema = Schema_.Int.check(
  Schema_.isBetween({ minimum: 0, maximum: lastMillisecondOfDay }),
).pipe(Schema_.brand("LocalTime"));

export type Type = typeof Schema.Type;

/** Validates a millisecond offset from the start of the day. */
export const fromMilliseconds = (value: number): Option.Option<Type> => Schema.makeOption(value);

/** Creates a trusted millisecond offset and throws when it is outside this day. */
export const unsafeFromMilliseconds = (value: number): Type => Schema.make(value);

/** Creates a local time when all components are integral and in range. */
export const fromParts = (
  hour: number,
  minute: number,
  second = 0,
  millisecond = 0,
): Option.Option<Type> => {
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59 ||
    !Number.isInteger(second) ||
    second < 0 ||
    second > 59 ||
    !Number.isInteger(millisecond) ||
    millisecond < 0 ||
    millisecond > 999
  ) {
    return Option.none();
  }
  return fromMilliseconds(
    hour * millisecondsPerHour +
      minute * millisecondsPerMinute +
      second * millisecondsPerSecond +
      millisecond,
  );
};

/** Creates a trusted local time and throws when any component is invalid. */
export const unsafeFromParts = (hour: number, minute: number, second = 0, millisecond = 0): Type =>
  Option.getOrThrowWith(
    fromParts(hour, minute, second, millisecond),
    () => new RangeError("LocalTime parts are outside their valid ranges"),
  );

/**
 * Parses exactly `HH:mm`, `HH:mm:ss`, or `HH:mm:ss.SSS`.
 * Short fields, 24:00, timezone suffixes, and sub-millisecond fractions fail.
 */
export const fromString = (value: string): Option.Option<Type> => {
  const match = localTimePattern.exec(value);
  if (match === null) return Option.none();
  const hourPart = match[1];
  const minutePart = match[2];
  if (hourPart === undefined || minutePart === undefined) return Option.none();
  return fromParts(
    Number(hourPart),
    Number(minutePart),
    match[3] === undefined ? 0 : Number(match[3]),
    match[4] === undefined ? 0 : Number(match[4]),
  );
};

/** Parses a trusted local-time string and throws when its syntax or value is invalid. */
export const unsafeFromString = (value: string): Type =>
  Option.getOrThrowWith(fromString(value), () => new RangeError(`Invalid local time: ${value}`));

export const toMilliseconds = (time: Type): number => time;

export const hour = (time: Type): number => Math.floor(time / millisecondsPerHour);

export const minute = (time: Type): number =>
  Math.floor((time % millisecondsPerHour) / millisecondsPerMinute);

export const second = (time: Type): number =>
  Math.floor((time % millisecondsPerMinute) / millisecondsPerSecond);

export const millisecond = (time: Type): number => time % millisecondsPerSecond;

/** Formats the canonical, fixed-width representation `HH:mm:ss.SSS`. */
export const toString = (time: Type): string =>
  `${String(hour(time)).padStart(2, "0")}:${String(minute(time)).padStart(2, "0")}:${String(second(time)).padStart(2, "0")}.${String(millisecond(time)).padStart(3, "0")}`;

export const compare = (left: Type, right: Type): -1 | 0 | 1 =>
  left < right ? -1 : left > right ? 1 : 0;

export const Equivalence = Equivalence_.make<Type>((left, right) => compare(left, right) === 0);

export const Order = Order_.make<Type>(compare);
