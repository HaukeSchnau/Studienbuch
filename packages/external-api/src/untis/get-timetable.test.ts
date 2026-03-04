import { FetchHttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { UntisTimetable } from "./get-timetable";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("Get timetable from Kadmos", () => {
  it("should get timetable", async () => {
    if (!untisLiveTestsEnabled) {
      return;
    }
    const timetable = await Effect.runPromise(
      UntisTimetable.get({
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
      }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
    );
    expect(timetable).toMatchSnapshot();
  });
});
