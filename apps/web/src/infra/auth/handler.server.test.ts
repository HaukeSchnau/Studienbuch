import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import { describe, expect, it, vi } from "vitest";
import type { RouteEffectOptions, RouteEffectRunner } from "#/infra/runtime/request.server.ts";
import { authOperation, authRoute, makeAuthRequestHandler } from "./handler.server.ts";

function fixture(response = new Response(null, { status: 204 })) {
  const output: Array<string> = [];
  const logger = Logger.make((options) => {
    output.push(Logger.formatJson.log(options));
  });
  const calls: Array<RouteEffectOptions> = [];
  const run: RouteEffectRunner<never> = (effect, options) => {
    calls.push(options);
    return Effect.runPromiseExit(
      effect.pipe(
        Effect.provide(
          Layer.merge(Logger.layer([logger]), Layer.succeed(Metric.MetricRegistry, new Map())),
        ),
      ),
    );
  };
  const auth = { handler: vi.fn(async () => response) };
  const handler = makeAuthRequestHandler({ resolveAuth: async () => auth, run });
  return { auth, calls, handler, output };
}

describe("Better Auth telemetry boundary", () => {
  it.each([
    ["/api/auth/get-session", "auth.session.get"],
    ["/api/auth/sign-in/email", "auth.sign_in.email"],
    ["/api/auth/passkey/generate-authenticate-options", "auth.sign_in.passkey.challenge"],
    ["/api/auth/passkey/verify-authentication", "auth.sign_in.passkey.verify"],
    ["/api/auth/sign-up/email", "auth.sign_up.email"],
    ["/api/auth/sign-out", "auth.sign_out"],
    ["/api/auth/request-password-reset", "auth.password_reset.request"],
    ["/api/auth/reset-password", "auth.password_reset.complete"],
    ["/api/auth/verify-email", "auth.verify_email"],
    ["/api/auth/passkey/generate-register-options", "auth.passkey.register.challenge"],
    ["/api/auth/passkey/verify-registration", "auth.passkey.register.verify"],
    ["/api/auth/passkey/list-user-passkeys", "auth.passkey.list"],
    ["/api/auth/passkey/delete-passkey", "auth.passkey.delete"],
  ])("normalizes %s", (pathname, operation) => {
    const request = new Request(`https://studienbuch.test${pathname}?secret=query`);
    expect(authOperation(request)).toBe(operation);
  });

  it("returns Better Auth's response and records a privacy-safe POST completion", async () => {
    const { calls, handler, output } = fixture(new Response(null, { status: 401 }));
    const request = new Request("https://studienbuch.test/api/auth/sign-in/email?token=query", {
      method: "POST",
      body: JSON.stringify({ email: "pii@example.invalid", password: "credential-sentinel" }),
      headers: { cookie: "session=secret-cookie" },
    });

    const response = await handler(request);

    expect(response.status).toBe(401);
    expect(calls).toEqual([{ request, route: authRoute }]);
    expect(output).toHaveLength(1);
    expect(output[0]).toContain("auth.request.completed");
    expect(output[0]).toContain("auth.sign_in.email");
    expect(output[0]).toContain("401");
    expect(output[0]).not.toContain("pii@example.invalid");
    expect(output[0]).not.toContain("credential-sentinel");
    expect(output[0]).not.toContain("secret-cookie");
    expect(output[0]).not.toContain("token=query");
  });

  it("traces session polling without logging each request", async () => {
    const { handler, output } = fixture();

    await handler(new Request("https://studienbuch.test/api/auth/get-session"));

    expect(output).toHaveLength(0);
  });
});
