/**
 * Calendar dates without a time zone (ADR 0001): Temporal records in domain code, ISO 8601 strings
 * such as `"2026-10-29"` in rows and arguments, which sort as dates in a device view. Core reads no
 * clock, so the caller computes "today" with `dateIn` and the school's `timeZone`, and passes it in.
 */
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as InstantFns from "temporal-polyfill/fns/Instant";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
import * as ZonedDateTimeFns from "temporal-polyfill/fns/ZonedDateTime";

export * as CivilTime from "./CivilTime.ts";

// Temporal also reads times, offsets, calendar annotations and six-digit years. A stored date is
// only ever this, so it compares as text in SQL.
const isoDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u, { expected: "a date as YYYY-MM-DD" }),
);

const fromIsoDate = SchemaTransformation.transformEffect<PlainDateFns.Record, string>({
  decode: (text, options) =>
    Effect.try({
      try: () => PlainDateFns.fromString(text, Calendar.getBasic),
      catch: () => new SchemaIssue.InvalidValue({ expected: "a date that exists" }, text, options),
    }),
  encode: (date) => Effect.succeed(PlainDateFns.toString(date)),
});

/** A calendar date, such as a due date. */
export const PlainDate = isoDate.pipe(
  Schema.decodeTo(
    Schema.declare(PlainDateFns.isRecord, { identifier: "PlainDate", expected: "a PlainDate" }),
    fromIsoDate,
  ),
);

export type PlainDate = typeof PlainDate.Type;

/** Earlier dates first. */
export const order: Order.Order<PlainDate> = Order.make((self, that) => {
  const sign = PlainDateFns.compare(self, that);

  return sign < 0 ? -1 : sign > 0 ? 1 : 0;
});

export const addDays = (date: PlainDate, days: number): PlainDate =>
  PlainDateFns.addDays(date, days);

/** A closed range: `start` and `end` both belong to it. */
export const DateRange = Schema.Struct({ start: PlainDate, end: PlainDate }).check(
  Schema.makeFilter(({ start, end }) => order(start, end) <= 0, {
    expected: "a range whose start is not after its end",
  }),
);

export type DateRange = typeof DateRange.Type;

export const contains = (range: DateRange, date: PlainDate): boolean =>
  order(range.start, date) <= 0 && order(date, range.end) <= 0;

const dateInZone = (epochMillis: number, timeZone: string) =>
  ZonedDateTimeFns.toPlainDate(
    InstantFns.toZonedDateTimeISO(InstantFns.fromEpochMilliseconds(epochMillis), timeZone),
  );

/** An IANA time zone that Temporal knows on this platform, such as `Europe/Berlin`. */
export const TimeZone = Schema.String.check(
  Schema.makeFilter((zone) => Result.isSuccess(Result.try(() => dateInZone(0, zone))), {
    expected: "an IANA time zone",
  }),
).pipe(Schema.brand("TimeZone"));

export type TimeZone = typeof TimeZone.Type;

/** The calendar date at an instant in a time zone, such as today's from `Date.now()`. */
export const dateIn = (epochMillis: number, timeZone: TimeZone): PlainDate =>
  dateInZone(epochMillis, timeZone);
