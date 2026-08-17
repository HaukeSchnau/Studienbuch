import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";

const PlainDateRecord = Schema.declare(PlainDate.isRecord, { identifier: "PlainDate" });

/**
 * Wire boundary for a timezone-free ISO calendar date.
 *
 * Domain code uses `PlainDate.Record` and `temporal-polyfill/fns/PlainDate` directly. This schema
 * solely translates its ISO 8601 string representation at persistence and transport edges.
 */
export const PlainDateSchema = PlainDateRecord.pipe(
  Schema.encodeTo(Schema.String, {
    decode: SchemaGetter.transformOrFail((value, options) =>
      Effect.try({
        try: () => PlainDate.fromString(value, Calendar.getBasic),
        catch: () =>
          new SchemaIssue.InvalidValue(
            { expected: "a valid ISO 8601 calendar date" },
            value,
            options,
          ),
      }),
    ),
    encode: SchemaGetter.transform(PlainDate.toString),
  }),
);
