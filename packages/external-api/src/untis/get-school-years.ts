import { HttpClient, HttpClientResponse } from "@effect/platform";
import { SimpleDate } from "@stu/lib";
import { Effect, Schema } from "effect";

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

  export const list = HttpClient.HttpClient.pipe(
    Effect.andThen(HttpClient.get("https://kadmos.webuntis.com/WebUntis/api/rest/view/v1/schoolyears")),
    Effect.flatMap(HttpClientResponse.schemaBodyJson(ResponseSchema)),
  );
}
