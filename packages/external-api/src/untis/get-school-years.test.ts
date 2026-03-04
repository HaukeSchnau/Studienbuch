import { FetchHttpClient } from "effect/unstable/http";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisSchoolYears } from "./get-school-years";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("Get school years from Kadmos", () => {
  const liveTest = untisLiveTestsEnabled ? it.effect : it.effect.skip;

  liveTest("should get school years", () =>
    Effect.gen(function* () {
      const schoolYears = yield* UntisSchoolYears.list;
      expect(schoolYears).toMatchSnapshot();
    }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
  );
});
