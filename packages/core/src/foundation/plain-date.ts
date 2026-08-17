import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";

const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Wire boundary for a timezone-free ISO calendar date.
 *
 * Domain code uses `PlainDate.Record` and `temporal-polyfill/fns/PlainDate` directly. This schema
 * solely translates the canonical `YYYY-MM-DD` representation at persistence and transport edges.
 */
export const PlainDateSchema = Schema.String.check(
  Schema.isPattern(isoPattern, {
    expected: "an ISO calendar date in the exact form YYYY-MM-DD",
  }),
).pipe(
  Schema.decodeTo(
    Schema.declare<PlainDate.Record>(
      (value): value is PlainDate.Record =>
        PlainDate.isRecord(value) &&
        value.calendarId === "iso8601" &&
        isoPattern.test(PlainDate.toString(value)),
      {
        identifier: "PlainDate",
        description: "A timezone-free date on the ISO 8601 calendar",
      },
    ),
    {
      decode: SchemaGetter.transformOrFail((value, options) =>
        Effect.try({
          try: () => PlainDate.fromString(value, Calendar.getBasic),
          catch: () =>
            new SchemaIssue.InvalidValue(
              { expected: "a valid ISO calendar date in the exact form YYYY-MM-DD" },
              value,
              options,
            ),
        }),
      ),
      encode: SchemaGetter.transform(PlainDate.toString),
    },
  ),
);
