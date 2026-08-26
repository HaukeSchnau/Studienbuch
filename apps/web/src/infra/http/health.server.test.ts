import { describe, expect, it, vi } from "vitest";
import type { RuntimeState } from "#/infra/runtime/lifecycle.server.ts";
import { makeHealthHandlers } from "./health.server.ts";

function fixture(options?: { readonly state?: RuntimeState; readonly databaseAnswers?: boolean }) {
  const pingDatabase = vi.fn(async () => options?.databaseAnswers ?? true);
  const handlers = makeHealthHandlers({
    runtimeState: () => options?.state ?? { status: "ready" },
    pingDatabase,
  });
  return { handlers, pingDatabase };
}

describe("health adapters", () => {
  it.each([
    ["starting", { status: "starting" }],
    ["failed", { status: "failed", reason: "bad config" }],
    ["stopped", { status: "stopped" }],
  ] as const)("keeps liveness independent of a %s runtime", (_name, state) => {
    const { handlers, pingDatabase } = fixture({ state });

    const response = handlers.liveness();

    // Liveness must not depend on the runtime or the database: failing it asks the supervisor to
    // restart, which cannot repair a dependency outage.
    expect(response.status).toBe(200);
    expect(pingDatabase).not.toHaveBeenCalled();
  });

  it("reports ready only once the runtime is built and the database answers", async () => {
    const { handlers, pingDatabase } = fixture();

    const response = await handlers.readiness();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ready" });
    expect(pingDatabase).toHaveBeenCalledOnce();
  });

  it("reports the immutable release revision when the host provides it", async () => {
    const handlers = makeHealthHandlers({
      runtimeState: () => ({ status: "ready" }),
      pingDatabase: async () => true,
      revision: "0123456789abcdef0123456789abcdef01234567",
    });

    await expect((await handlers.readiness()).json()).resolves.toEqual({
      status: "ready",
      revision: "0123456789abcdef0123456789abcdef01234567",
    });
  });

  it("does not claim readiness before the runtime is warm", async () => {
    const { handlers, pingDatabase } = fixture({ state: { status: "starting" } });

    const response = await handlers.readiness();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "not_ready", runtime: "starting" });
    expect(pingDatabase).not.toHaveBeenCalled();
  });

  it("withdraws readiness when the database stops answering after startup", async () => {
    const { handlers } = fixture({ databaseAnswers: false });

    const response = await handlers.readiness();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "not_ready",
      runtime: "database_unavailable",
    });
  });
});
