import { FetchHttpClient } from "effect/unstable/http";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisTeachers } from "./get-teachers";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("Get teachers from Kadmos", () => {
  const liveTest = untisLiveTestsEnabled ? it.effect : it.effect.skip;

  liveTest("should get teachers", () =>
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
    }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
  );
});
