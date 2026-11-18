/**
 * Calendar dates without a time zone (ADR 0001): Temporal records in domain code, ISO 8601 strings
 * such as `"2026-10-29"` in rows and arguments, which sort as dates in a device view. Core reads no
 * clock, so the caller reads the instant and `School.today` turns it into the school's date.
 */
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as InstantFns from "temporal-polyfill/fns/Instant";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
import * as ZonedDateTimeFns from "temporal-polyfill/fns/ZonedDateTime";
import { CivilDate } from "./CivilDate.ts";

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
export const order = CivilDate.order;

export const addDays = CivilDate.addDays;

export const dayOfWeek = CivilDate.dayOfWeek;

export const isoWeek = CivilDate.isoWeek;

const isoWeekText = /^(\d{4})-W(\d{2})$/u;

/** An ISO 8601 week such as `2026-W53`, in a year that has it: most years end with week 52. */
export const IsoWeek = Schema.String.check(
  Schema.makeFilter(
    (text) => {
      const [, year, week] = isoWeekText.exec(text) ?? [];

      if (year === undefined || week === undefined) return false;

      // 4 January is always in week 1, so the week's Monday follows from it.
      const january4 = PlainDateFns.create(Number(year), 1, 4);

      return isoWeek(addDays(january4, 7 * Number(week) - 6 - dayOfWeek(january4))) === text;
    },
    { expected: "an ISO week its year has, such as 2026-W53" },
  ),
);

/** A time of day as milliseconds since midnight, such as `28_800_000` for 08:00. */
export const TimeOfDay = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 86_400_000 }));

/**
 * An instant as a UTC timestamp, written as `2026-11-18T06:30:00.000Z`. It is for when something
 * happened, such as the import's last read, never for when school happens.
 */
export const Instant = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u, {
    expected: "an instant as YYYY-MM-DDTHH:mm:ss.sssZ",
  }),
).pipe(
  Schema.decodeTo(
    Schema.DateTimeUtc,
    SchemaTransformation.transformEffect<DateTime.Utc, string>({
      // `Date` reads 30 February as 2 March, so the instant has to write back as it was read.
      decode: (text, options) =>
        Option.match(Option.map(DateTime.make(text), DateTime.toUtc), {
          onSome: (utc) =>
            DateTime.formatIso(utc) === text
              ? Effect.succeed(utc)
              : Effect.fail(
                  new SchemaIssue.InvalidValue(
                    { expected: "an instant that exists" },
                    text,
                    options,
                  ),
                ),
          onNone: () =>
            Effect.fail(
              new SchemaIssue.InvalidValue({ expected: "an instant that exists" }, text, options),
            ),
        }),
      encode: (utc) => Effect.succeed(DateTime.formatIso(utc)),
    }),
  ),
);

export type Instant = typeof Instant.Type;

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
