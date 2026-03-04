import { FetchHttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { UntisTeachers } from "./get-teachers";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("Get teachers from Kadmos", () => {
  it("should get teachers", async () => {
    if (!untisLiveTestsEnabled) {
      return;
    }
    const teachers = await Effect.runPromise(
      UntisTeachers.list({
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
      }).pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
    );
    expect(teachers).toMatchSnapshot();
  });
});
