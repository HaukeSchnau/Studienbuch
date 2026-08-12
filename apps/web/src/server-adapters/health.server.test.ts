import { describe, expect, it } from "vitest";
import { handleLiveness, handleReadiness } from "./health.server.ts";

describe("health adapters", () => {
  it("keeps liveness independent from runtime readiness", async () => {
    const response = handleLiveness();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "alive" });
  });

  it("does not claim readiness before runtime warmup", async () => {
    const response = handleReadiness();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: "not_ready" });
  });
});
