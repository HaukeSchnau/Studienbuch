import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { SimpleDate, TimeOfDay } from "@stu/lib";
import { Data, Effect, Option, Schema, SchemaGetter, SchemaIssue } from "effect";
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

const DurationSchema = Schema.Struct({
  start: Schema.String,
  end: Schema.String,
}).pipe(
  Schema.decodeTo(
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
      decode: SchemaGetter.transformOrFail((duration) =>
        parseDuration(duration).pipe(
          Effect.mapError(
            (error) =>
              new SchemaIssue.InvalidValue(Option.some(duration), {
                message: error instanceof Error ? error.message : String(error),
              }),
          ),
        ),
      ),
      encode: SchemaGetter.forbidden(() => "Encoding duration back to plain text is forbidden."),
    },
  ),
);

const PositionSchema = Schema.Struct({
  current: Schema.Struct({
    type: Schema.Literals(["SUBJECT", "TEACHER", "ROOM", "CLASS", "INFO"]),
    status: Schema.Literals(["REGULAR", "ADDED"]),
    shortName: Schema.String,
    longName: Schema.String,
    displayName: Schema.String,
  }).pipe(Schema.NullOr),
  removed: Schema.Struct({
    type: Schema.Literals(["TEACHER", "ROOM", "CLASS"]),
    status: Schema.Literal("REMOVED"),
    shortName: Schema.String,
    longName: Schema.String,
    displayName: Schema.String,
  }).pipe(Schema.NullOr),
});

const PositionValueSchema = Schema.Union([PositionSchema, Schema.Array(PositionSchema)]).pipe(Schema.NullOr);

const ResponseSchema = Schema.Struct({
  errors: Schema.Tuple([]),
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
      status: Schema.Literals(["REGULAR", "NO_DATA"]),
      dayEntries: Schema.Tuple([]),
      gridEntries: Schema.Array(
        Schema.Struct({
          ids: Schema.Array(Schema.Number),
          duration: DurationSchema,
          type: Schema.Literals(["NORMAL_TEACHING_PERIOD", "EVENT", "EXAM"]),
          status: Schema.Literals(["REGULAR", "CHANGED", "ADDITIONAL", "CANCELLED"]),
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
    const client = yield* HttpClient.HttpClient;

    return yield* client
      .get(untisLegacyApiUrl("/timetable/entries"), {
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
      })
      .pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(ResponseSchema)),
        withUntisHttpResilience("timetable.get"),
      );
  });
}
