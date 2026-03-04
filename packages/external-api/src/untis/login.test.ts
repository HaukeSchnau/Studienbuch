import { FetchHttpClient } from "effect/unstable/http";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisAuth } from "./login";
import { getUntisTestCredentials, untisLiveTestsEnabled } from "./test-credentials";

describe("UntisAuth.selectSchool", () => {
  const schools: Array<UntisAuth.SchoolLookup> = [
    {
      displayName: "IGS Lilienthal",
      loginName: "igs-lilienthal",
      server: "igs-lilienthal.webuntis.com",
      serverUrl: "https://igs-lilienthal.webuntis.com/WebUntis/?school=igs-lilienthal",
    },
    {
      displayName: "Other School",
      loginName: "other-school",
      server: "other-school.webuntis.com",
      serverUrl: "https://other-school.webuntis.com/WebUntis/?school=other-school",
    },
  ];

  it("matches by display name", () => {
    expect(UntisAuth.selectSchool({ kadmosName: "IGS Lilienthal", schools })?.loginName).toBe("igs-lilienthal");
  });

  it("matches by login name", () => {
    expect(UntisAuth.selectSchool({ kadmosName: "igs-lilienthal", schools })?.displayName).toBe("IGS Lilienthal");
  });

  it("matches by full URL", () => {
    expect(
      UntisAuth.selectSchool({
        kadmosName: "https://igs-lilienthal.webuntis.com/WebUntis/?school=igs-lilienthal",
        schools,
      })?.server,
    ).toBe("igs-lilienthal.webuntis.com");
  });

  it("returns undefined when no exact match exists", () => {
    expect(UntisAuth.selectSchool({ kadmosName: "Lilienthal", schools })).toBeUndefined();
  });
});

describe("Kadmos Login", () => {
  const liveTest = untisLiveTestsEnabled ? it.effect : it.effect.skip;

  liveTest("should login", () =>
    UntisAuth.login(getUntisTestCredentials()).pipe(Effect.provide(FetchHttpClient.layer)),
  );
});
