import { HttpClient, HttpClientResponse } from "@effect/platform";
import { SimpleDate } from "@stu/lib";
import { Effect, Schema } from "effect";
import { withUntisHttpResilience } from "./http";
import { untisLegacyApiUrl } from "./urls";

export namespace UntisTeachers {
  const ResponseSchema = Schema.Struct({
    resourceType: Schema.Literal("TEACHER"),
    preSelected: Schema.Unknown,
    buildings: Schema.Array(Schema.Unknown),
    departments: Schema.Array(
      Schema.Struct({
        id: Schema.Number,
        shortName: Schema.String,
      }),
    ),
    roomGroups: Schema.Array(Schema.Unknown),
    resourceTypes: Schema.Array(Schema.Unknown),
    assignmentGroups: Schema.Array(Schema.Unknown),
    classes: Schema.Array(Schema.Unknown),
    resources: Schema.Array(Schema.Unknown),
    rooms: Schema.Array(Schema.Unknown),
    subjects: Schema.Array(Schema.Unknown),
    students: Schema.Array(Schema.Unknown),
    teachers: Schema.Array(
      Schema.Struct({
        teacher: Schema.Struct({
          id: Schema.Number,
          shortName: Schema.String,
          longName: Schema.String,
          displayName: Schema.String,
        }),
        departments: Schema.Array(Schema.Unknown),
      }),
    ),
  });

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

    return yield* HttpClient.HttpClient.pipe(
      Effect.flatMap((client) =>
        client.get(untisLegacyApiUrl("/timetable/filter"), {
          headers: {
            "x-webuntis-api-school-year-id": schoolYearId.toString(),
          },
          urlParams: {
            resourceType: "TEACHER",
            timetableType: "STANDARD",
            start: encodedStart,
            end: encodedEnd,
          },
        }),
      ),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(ResponseSchema)),
      withUntisHttpResilience("teachers.list"),
    );
  });
}
