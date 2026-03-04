import { FetchHttpClient } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { UntisSchoolYears } from "./get-school-years";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("Get school years from Kadmos", () => {
  it("should get school years", async () => {
    if (!untisLiveTestsEnabled) {
      return;
    }
    const schoolYears = await Effect.runPromise(
      UntisSchoolYears.list.pipe(UntisAuth.provide(getUntisTestCredentials()), Effect.provide(FetchHttpClient.layer)),
    );
    expect(schoolYears).toMatchSnapshot();
  });
});
