import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { SimpleDate } from "@stu/lib";
import { Effect, Schema } from "effect";
import { withUntisHttpResilience } from "./http";
import { untisLegacyApiUrl } from "./urls";

export namespace UntisSchoolYears {
  const ResponseSchema = Schema.Array(
    Schema.Struct({
      dateRange: Schema.Struct({
        start: SimpleDate.SimpleDateSchema,
        end: SimpleDate.SimpleDateSchema,
      }),
      id: Schema.Number,
      name: Schema.String,
    }),
  );

  export const list = HttpClient.get(untisLegacyApiUrl("/schoolyears")).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(ResponseSchema)),
    withUntisHttpResilience("schoolYears.list"),
  );
}
