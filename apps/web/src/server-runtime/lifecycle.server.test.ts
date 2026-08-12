import { describe, expect, it, vi } from "vitest";
import { createLifecycleController } from "./lifecycle.server.ts";

describe("application runtime lifecycle", () => {
  it("warms and disposes exactly once under concurrent calls", async () => {
    const actions = {
      warm: vi.fn(async () => undefined),
      flush: vi.fn(async () => undefined),
      dispose: vi.fn(async () => undefined),
    };
    const lifecycle = createLifecycleController(actions);

    await Promise.all([lifecycle.warm(), lifecycle.warm(), lifecycle.warm()]);
    expect(lifecycle.state()).toEqual({ status: "ready" });
    expect(actions.warm).toHaveBeenCalledOnce();

    await Promise.all([lifecycle.dispose(), lifecycle.dispose()]);
    expect(lifecycle.state()).toEqual({ status: "stopped" });
    expect(actions.flush).toHaveBeenCalledOnce();
    expect(actions.dispose).toHaveBeenCalledOnce();
  });

  it("reports startup failure and still disposes", async () => {
    const actions = {
      warm: vi.fn(async () => Promise.reject(new Error("bad config"))),
      flush: vi.fn(async () => undefined),
      dispose: vi.fn(async () => undefined),
    };
    const lifecycle = createLifecycleController(actions);

    await expect(lifecycle.warm()).rejects.toThrow("bad config");
    expect(lifecycle.state()).toEqual({ status: "failed", reason: "bad config" });
    await lifecycle.dispose();
    expect(actions.flush).not.toHaveBeenCalled();
    expect(actions.dispose).toHaveBeenCalledOnce();
  });
});
