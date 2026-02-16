import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisClasses } from "./get-classes";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("Get teachers from Kadmos", () => {
  const liveTest = untisLiveTestsEnabled ? it.effect : it.effect.skip;

  liveTest("should get teachers", () =>
    Effect.gen(function* () {
      const classes = yield* UntisClasses.list({
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
      expect(classes.classes.length).toBeGreaterThan(0);
      expect(classes.departments.length).toBeGreaterThan(0);
      expect(classes.classes[0]).toEqual(
        expect.objectContaining({
          class: expect.objectContaining({
            id: expect.any(Number),
            shortName: expect.any(String),
            longName: expect.any(String),
            displayName: expect.any(String),
          }),
          department: expect.objectContaining({
            id: expect.any(Number),
            shortName: expect.any(String),
            longName: expect.any(String),
            displayName: expect.any(String),
          }),
        }),
      );
    }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
  );
});
