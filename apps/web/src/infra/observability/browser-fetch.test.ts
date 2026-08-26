import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithBrowserTelemetry,
  installBrowserTelemetryFetch,
  type BrowserFetch,
} from "./browser-fetch.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("browser telemetry fetch bridge", () => {
  it("uses the platform fetch until browser telemetry has loaded", async () => {
    const platformFetch = vi.fn<BrowserFetch>(async () => new Response(null, { status: 204 }));
    globalThis.fetch = platformFetch;

    await fetchWithBrowserTelemetry("https://studienbuch.test/api/auth/get-session");

    expect(platformFetch).toHaveBeenCalledOnce();
  });

  it("routes requests through telemetry and restores the previous fetch on cleanup", async () => {
    const platformFetch = vi.fn<BrowserFetch>(async () => new Response(null, { status: 204 }));
    const telemetryFetch = vi.fn<BrowserFetch>(async () => new Response(null, { status: 200 }));
    globalThis.fetch = platformFetch;

    const remove = installBrowserTelemetryFetch(telemetryFetch);
    await fetchWithBrowserTelemetry("https://studienbuch.test/api/auth/sign-in/email", {
      method: "POST",
    });
    remove();
    await fetchWithBrowserTelemetry("https://studienbuch.test/api/auth/get-session");

    expect(telemetryFetch).toHaveBeenCalledOnce();
    expect(platformFetch).toHaveBeenCalledOnce();
  });
});
