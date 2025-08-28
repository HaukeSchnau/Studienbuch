import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisTeachers } from "./get-teachers";
import { UntisAuth } from "./login";

describe("Get teachers from Kadmos", () => {
  it.effect("should get teachers", () =>
    Effect.gen(function* () {
      const teachers = yield* UntisTeachers.list({
        schoolYearId: 7,
        start: {
          year: 2025,
          month: 8,
          day: 25,
        },
        end: {
          year: 2025,
          month: 8,
          day: 29,
        },
      });
      expect(teachers).toMatchSnapshot();
    }).pipe(
      UntisAuth.provide({
        kadmosName: "IGS Lilienthal",
        kadmosUsername: "hauke.studienbuch",
        kadmosPassword: "App#Hauke2024",
      }),
      Effect.provide(FetchHttpClient.layer),
    ),
  );
});
