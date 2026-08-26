import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installBrowserTelemetryFetch,
  type BrowserFetch,
} from "#/infra/observability/browser-fetch.ts";
import { authClient } from "./client.ts";

let removeTelemetryFetch: (() => void) | undefined;

afterEach(() => {
  removeTelemetryFetch?.();
  removeTelemetryFetch = undefined;
});

describe("Better Auth browser telemetry", () => {
  it("sends email sign-in through the observed fetch", async () => {
    const telemetryFetch = vi.fn<BrowserFetch>(async () =>
      Response.json(
        { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
        { status: 401 },
      ),
    );
    removeTelemetryFetch = installBrowserTelemetryFetch(telemetryFetch);

    await authClient.signIn.email({
      email: "telemetry-check@example.invalid",
      password: "not-a-real-password",
    });

    expect(telemetryFetch).toHaveBeenCalledOnce();
    const [input, init] = telemetryFetch.mock.calls[0] ?? [];
    expect(input).toEqual(new URL("http://localhost:3000/api/auth/sign-in/email"));
    expect(init?.method).toBe("POST");
  });
});
