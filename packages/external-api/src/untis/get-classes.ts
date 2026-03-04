import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { SimpleDate } from "@stu/lib";
import { Effect, Schema } from "effect";
import { withUntisHttpResilience } from "./http";
import { untisLegacyApiUrl } from "./urls";

export namespace UntisClasses {
  const GetClassesResponseSchema = Schema.Struct({
    departments: Schema.Array(
      Schema.Struct({
        id: Schema.Number,
        shortName: Schema.String,
        longName: Schema.String,
        displayName: Schema.String,
      }),
    ),
    classes: Schema.Array(
      Schema.Struct({
        class: Schema.Struct({
          id: Schema.Number,
          shortName: Schema.String,
          longName: Schema.String,
          displayName: Schema.String,
        }),
        classTeacher1: Schema.Struct({
          id: Schema.Number,
          shortName: Schema.String,
          longName: Schema.String,
          displayName: Schema.String,
        }).pipe(Schema.NullOr),
        classTeacher2: Schema.Struct({
          id: Schema.Number,
          shortName: Schema.String,
          longName: Schema.String,
          displayName: Schema.String,
        }).pipe(Schema.NullOr),
        department: Schema.Struct({
          id: Schema.Number,
          shortName: Schema.String,
          longName: Schema.String,
          displayName: Schema.String,
        }),
      }),
    ),
  });

  type GetClassesResponse = typeof GetClassesResponseSchema.Type;
  export type Class = GetClassesResponse["classes"][number];
  export type ClassTeacher = Class["classTeacher1"];

  export const list = Effect.fn(function* ({
    schoolYearId,
    start,
    end,
  }: {
    schoolYearId: number;
    start: SimpleDate;
    end: SimpleDate;
  }) {
    const encodedStart = yield* SimpleDate.encode(start);
    const encodedEnd = yield* SimpleDate.encode(end);
    const client = yield* HttpClient.HttpClient;

    return yield* client
      .get(untisLegacyApiUrl("/timetable/filter"), {
        headers: {
          "x-webuntis-api-school-year-id": schoolYearId.toString(),
        },
        urlParams: {
          resourceType: "CLASS",
          timetableType: "STANDARD",
          start: encodedStart,
          end: encodedEnd,
        },
      })
      .pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(GetClassesResponseSchema)),
        withUntisHttpResilience("classes.list"),
      );
  });
}
