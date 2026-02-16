import { FetchHttpClient } from "@effect/platform";
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
      expect(schoolYears.length).toBeGreaterThan(0);
      expect(schoolYears[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: expect.any(String),
          dateRange: expect.objectContaining({
            start: expect.objectContaining({
              year: expect.any(Number),
              month: expect.any(Number),
              day: expect.any(Number),
            }),
            end: expect.objectContaining({
              year: expect.any(Number),
              month: expect.any(Number),
              day: expect.any(Number),
            }),
          }),
        }),
      );
    }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
  );
});
