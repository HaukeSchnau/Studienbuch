import { describe, expect, it, vi } from "vitest";
import { installNodeShutdownHandlers } from "./shutdown.server.ts";

describe("Node runtime shutdown", () => {
  it.each(["SIGINT", "SIGTERM"] as const)("disposes on %s", async (signal) => {
    const existing = new Set(process.listeners(signal));
    const dispose = vi.fn(async () => undefined);
    const remove = installNodeShutdownHandlers({ dispose });

    try {
      const handler = process.listeners(signal).find((listener) => !existing.has(listener));
      expect(handler).toBeDefined();
      handler?.(signal);
      await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce());
    } finally {
      remove();
    }
  });
});
