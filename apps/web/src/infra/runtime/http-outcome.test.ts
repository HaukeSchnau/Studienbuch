import { describe, expect, it } from "vite-plus/test";
import { httpAvailabilityOutcome } from "./http-outcome.ts";

describe("HTTP availability outcome", () => {
  it("does not count an expected client rejection as downtime", () => {
    expect(httpAvailabilityOutcome(new Response(null, { status: 401 }))).toBe("success");
  });

  it("counts a server response failure against availability", () => {
    expect(httpAvailabilityOutcome(new Response(null, { status: 503 }))).toBe("failure");
  });
});
