import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisSchoolYears } from "./get-school-years";
import { UntisAuth } from "./login";

describe("Get school years from Kadmos", () => {
  it.effect("should get school years", () =>
    Effect.gen(function* () {
      const schoolYears = yield* UntisSchoolYears.list;
      expect(schoolYears).toMatchSnapshot();
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
