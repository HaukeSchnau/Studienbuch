import { FetchHttpClient } from "@effect/platform";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { UntisAuth } from "./login";

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
  const isLiveTestEnabled = process.env.UNTIS_LIVE_TESTS === "1";
  const liveTest = isLiveTestEnabled ? it.effect : it.effect.skip;

  liveTest("should login", () =>
    UntisAuth.login({
      kadmosName: "IGS Lilienthal",
      kadmosUsername: "hauke.studienbuch",
      kadmosPassword: "App#Hauke2024",
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );
});
