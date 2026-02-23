import { HttpClient, HttpClientResponse } from "@effect/platform";
import { SimpleDate, TimeOfDay } from "@stu/lib";
import { Data, Effect, ParseResult, Schema } from "effect";
import { withUntisHttpResilience } from "./http";
import { untisLegacyApiUrl } from "./urls";

class InvalidDurationError extends Data.TaggedError("InvalidDurationError")<{ value: string }> {}

const parseDurationComponent = Effect.fn(function* (duration: string) {
  const [date, time] = duration.split("T");
  if (!date || !time) return yield* Effect.fail(new InvalidDurationError({ value: duration }));
  return {
    date: yield* SimpleDate.decode(date),
    time: yield* TimeOfDay.decode(time),
  };
});

const parseDuration = Effect.fn(function* (duration: { start: string; end: string }) {
  return {
    start: yield* parseDurationComponent(duration.start),
    end: yield* parseDurationComponent(duration.end),
  };
});

const DurationSchema = Schema.transformOrFail(
  Schema.Struct({
    start: Schema.String,
    end: Schema.String,
  }),
  Schema.Struct({
    start: Schema.Struct({
      date: Schema.Struct({
        year: Schema.Int,
        month: Schema.Int,
        day: Schema.Int,
      }),
      time: Schema.Number,
    }),
    end: Schema.Struct({
      date: Schema.Struct({
        year: Schema.Int,
        month: Schema.Int,
        day: Schema.Int,
      }),
      time: Schema.Number,
    }),
  }),
  {
    strict: true,
    decode: (duration, _, ast) =>
      parseDuration(duration).pipe(
        Effect.catchAll((err) => ParseResult.fail(new ParseResult.Type(ast, duration, err.message))),
      ),
    encode: (duration, _, ast) =>
      ParseResult.fail(new ParseResult.Forbidden(ast, duration, "Encoding duration back to plain text is forbidden.")),
  },
);

const PositionSchema = Schema.Struct({
  current: Schema.Struct({
    type: Schema.Literal("SUBJECT", "TEACHER", "ROOM", "CLASS", "INFO"),
    status: Schema.Literal("REGULAR", "ADDED"),
    shortName: Schema.String,
    longName: Schema.String,
    displayName: Schema.String,
  }).pipe(Schema.NullOr),
  removed: Schema.Struct({
    type: Schema.Literal("TEACHER", "ROOM", "CLASS"),
    status: Schema.Literal("REMOVED"),
    shortName: Schema.String,
    longName: Schema.String,
    displayName: Schema.String,
  }).pipe(Schema.NullOr),
});

const PositionValueSchema = Schema.Union(PositionSchema, Schema.Array(PositionSchema)).pipe(Schema.NullOr);

const ResponseSchema = Schema.Struct({
  errors: Schema.Tuple(),
  days: Schema.Array(
    Schema.Struct({
      date: SimpleDate.SimpleDateSchema,
      resourceType: Schema.Literal("CLASS"),
      resource: Schema.Struct({
        id: Schema.Number,
        shortName: Schema.String,
        longName: Schema.String,
        displayName: Schema.String,
      }),
      status: Schema.Literal("REGULAR", "NO_DATA"),
      dayEntries: Schema.Tuple(),
      gridEntries: Schema.Array(
        Schema.Struct({
          ids: Schema.Array(Schema.Number),
          duration: DurationSchema,
          type: Schema.Literal("NORMAL_TEACHING_PERIOD", "EVENT", "EXAM"),
          status: Schema.Literal("REGULAR", "CHANGED", "ADDITIONAL", "CANCELLED"),
          statusDetail: Schema.Literal("SUBSTITUTED").pipe(Schema.NullOr),
          position1: PositionValueSchema,
          position2: PositionValueSchema,
          position3: PositionValueSchema,
          position4: PositionValueSchema,
          position5: PositionValueSchema,
        }),
      ),
    }),
  ),
});

type GetTimetableResponse = typeof ResponseSchema.Type;

interface Options {
  start: SimpleDate;
  end: SimpleDate;
  kadmosClassId: number;
  schoolYearId: number;
}

export namespace UntisTimetable {
  export type TimetableEntry = GetTimetableResponse["days"][number]["gridEntries"][number];

  export const get = Effect.fn(function* (options: Options) {
    const encodedStart = yield* SimpleDate.encode(options.start);
    const encodedEnd = yield* SimpleDate.encode(options.end);

    return yield* HttpClient.HttpClient.pipe(
      Effect.flatMap((client) =>
        client.get(untisLegacyApiUrl("/timetable/entries"), {
          headers: {
            "x-webuntis-api-school-year-id": options.schoolYearId.toString(),
          },
          urlParams: {
            start: encodedStart,
            end: encodedEnd,
            format: "0",
            resourceType: "CLASS",
            resources: options.kadmosClassId.toString(),
            periodTypes: "",
            timetableType: "STANDARD",
          },
        }),
      ),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(ResponseSchema)),
      withUntisHttpResilience("timetable.get"),
    );
  });
}
