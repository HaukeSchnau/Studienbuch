import * as Effect from "effect/Effect";
import * as Equivalence_ from "effect/Equivalence";
import * as Option from "effect/Option";
import * as Order_ from "effect/Order";
import * as Schema_ from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";

const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

const Encoded = Schema_.String.check(
  Schema_.makeFilter((value) => isoPattern.test(value), {
    expected: "an ISO calendar date in the exact form YYYY-MM-DD",
  }),
);

const Decoded = Schema_.declare<PlainDate.Record>(
  (value): value is PlainDate.Record => PlainDate.isRecord(value) && value.calendarId === "iso8601",
  {
    identifier: "CalendarDate",
    description: "A timezone-free date on the ISO 8601 calendar",
  },
).pipe(Schema_.brand("CalendarDate"));

/**
 * A calendar date without a time or timezone.
 *
 * Its wire representation is exactly `YYYY-MM-DD`; its decoded representation
 * is Temporal's immutable PlainDate record. Keeping civil dates separate from
 * instants prevents timezone and daylight-saving changes from shifting them.
 */
export const Schema = Encoded.pipe(
  Schema_.decodeTo(
    Decoded,
    SchemaTransformation.transformOrFail({
      decode: (value, options) =>
        Effect.try({
          try: () => PlainDate.fromString(value, Calendar.getBasic),
          catch: () =>
            new SchemaIssue.InvalidValue(
              { expected: "a valid ISO calendar date in the exact form YYYY-MM-DD" },
              value,
              options,
            ),
        }),
      encode: (value) => Effect.succeed(PlainDate.toString(value)),
    }),
  ),
);

export type Type = typeof Schema.Type;

/** Parses an untrusted ISO date, discarding validation details. */
export const fromString = Schema_.decodeOption(Schema);

/** Parses an ISO date and throws on invalid trusted input. */
export const unsafeFromString = Schema_.decodeSync(Schema);

/** Creates a date when all parts form a valid four-digit ISO calendar date. */
export const fromParts = (year: number, month: number, day: number): Option.Option<Type> => {
  if (
    !Number.isInteger(year) ||
    year < 0 ||
    year > 9_999 ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return Option.none();
  }
  return fromString(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );
};

/** Creates a date and throws when trusted parts do not form a valid date. */
export const unsafeFromParts = (year: number, month: number, day: number): Type =>
  unsafeFromString(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  );

/** Returns the canonical `YYYY-MM-DD` representation. */
export const toString = (date: Type): string => PlainDate.toString(date);

const tryAddDays = Option.liftThrowable((date: Type, days: number): Type =>
  Decoded.make(PlainDate.addDays(date, days)),
);

/** Adds a safe-integer number of calendar days without consulting a clock or timezone. */
export const addDays = (date: Type, days: number): Option.Option<Type> =>
  Number.isSafeInteger(days) ? tryAddDays(date, days) : Option.none();

/** Adds calendar days and throws when a trusted offset or resulting date is invalid. */
export const unsafeAddDays = (date: Type, days: number): Type =>
  Option.getOrThrowWith(
    addDays(date, days),
    () => new RangeError("CalendarDate day offset or result is outside the supported range"),
  );

/** Counts calendar-day boundaries from `start` to `end`. */
export const daysUntil = (start: Type, end: Type): number => PlainDate.diffDays(start, end);

/** Compares dates chronologically. */
export const compare = (left: Type, right: Type): -1 | 0 | 1 => {
  const result = PlainDate.compare(left, right);
  return result < 0 ? -1 : result > 0 ? 1 : 0;
};

export const Equivalence = Equivalence_.make<Type>((left, right) => compare(left, right) === 0);

export const Order = Order_.make<Type>(compare);

/** ISO weekday, where Monday is 1 and Sunday is 7. */
export const dayOfWeek = (date: Type): number => PlainDate.dayOfWeek(date);

/** ISO week number. ISO dates always have a week number. */
export const weekOfYear = (date: Type): number => {
  const week = PlainDate.weekOfYear(date);
  if (week === undefined) throw new Error("ISO calendar date has no week number");
  return week;
};

/** ISO week-numbering year, which may differ near a calendar-year boundary. */
export const yearOfWeek = (date: Type): number => {
  const year = PlainDate.yearOfWeek(date);
  if (year === undefined) throw new Error("ISO calendar date has no week-numbering year");
  return year;
};

/** Whether the date's ISO calendar year contains February 29. */
export const inLeapYear = (date: Type): boolean => PlainDate.inLeapYear(date);

export * as CalendarDate from "./calendar-date";
