import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisTimetable } from "./get-timetable";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("Get timetable from Kadmos", () => {
  const liveTest = untisLiveTestsEnabled ? it.effect : it.effect.skip;

  liveTest("should get timetable", () =>
    Effect.gen(function* () {
      const timetable = yield* UntisTimetable.get({
        schoolYearId: 7,
        start: {
          year: 2025,
          month: 8,
          day: 24,
        },
        end: {
          year: 2025,
          month: 8,
          day: 31,
        },
        kadmosClassId: 503,
      });
      expect(timetable.errors).toEqual([]);
      expect(timetable.days.length).toBeGreaterThan(0);
      expect(timetable.days[0]).toEqual(
        expect.objectContaining({
          resourceType: "CLASS",
          status: expect.stringMatching(/^(REGULAR|NO_DATA)$/),
          resource: expect.objectContaining({
            id: expect.any(Number),
            shortName: expect.any(String),
            longName: expect.any(String),
            displayName: expect.any(String),
          }),
        }),
      );

      const gridEntries = timetable.days.flatMap((day) => day.gridEntries);
      expect(gridEntries.length).toBeGreaterThan(0);
      expect(gridEntries[0]).toEqual(
        expect.objectContaining({
          ids: expect.any(Array),
          status: expect.stringMatching(/^(REGULAR|CHANGED|ADDITIONAL|CANCELLED)$/),
        }),
      );
    }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
  );
});
