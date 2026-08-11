import { describe, expect, it } from "vite-plus/test";
import { mainProfileRoute } from "../../routing/params";
import { getSetupGateRedirect } from "./setup-gate-policy";

describe("setup gate policy", () => {
  it("pins unfinished users to the exact required setup step", () => {
    expect(
      getSetupGateRedirect({
        isSetupRoute: true,
        pathname: "/setup/class-and-courses",
        requiredSetupPath: "/setup/license-key",
      }),
    ).toBe("/setup/license-key");

    expect(
      getSetupGateRedirect({
        isSetupRoute: false,
        pathname: "/profile/edit",
        requiredSetupPath: "/setup/name-and-year",
      }),
    ).toBe("/setup/name-and-year");
  });

  it("keeps completed users out of onboarding routes", () => {
    expect(
      getSetupGateRedirect({
        isSetupRoute: true,
        pathname: "/setup/name-and-year",
        requiredSetupPath: null,
      }),
    ).toBe(mainProfileRoute);
  });

  it("allows app routes after setup is complete", () => {
    expect(
      getSetupGateRedirect({
        isSetupRoute: false,
        pathname: "/profile/edit",
        requiredSetupPath: null,
      }),
    ).toBeNull();
  });
});
