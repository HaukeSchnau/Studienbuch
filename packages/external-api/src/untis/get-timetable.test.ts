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
      expect(timetable).toMatchSnapshot();
    }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
  );
});
