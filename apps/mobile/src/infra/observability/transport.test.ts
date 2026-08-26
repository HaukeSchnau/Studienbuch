import { TelemetryDelivery, type ClientTelemetryEnvelope } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vite-plus/test";
import { telemetryTransportLayer } from "./transport.ts";

const envelope: ClientTelemetryEnvelope = {
  schemaVersion: 1,
  serviceName: "studienbuch-mobile",
  serviceVersion: "test-version",
  environment: "test",
  sentAtUnixMillis: 1_000,
  records: [],
};

describe("mobile telemetry transport", () => {
  it("obtains a fresh Better Auth session cookie for every Effect HTTP send", async () => {
    const sessionCookie = vi
      .fn<() => Promise<string | undefined>>()
      .mockResolvedValueOnce("better-auth.session_token=first-session")
      .mockResolvedValueOnce("better-auth.session_token=refreshed-session");
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(JSON.stringify({ acceptedRecords: 0 }), {
          status: 202,
          headers: { "content-type": "application/json" },
        }),
    );
    const program = Effect.gen(function* () {
      const delivery = yield* TelemetryDelivery;
      yield* delivery.send(envelope);
      yield* delivery.send(envelope);
    }).pipe(
      Effect.provide(
        telemetryTransportLayer({
          endpoint: "https://studienbuch.test/api/observability/v1/telemetry",
          sessionCookie,
          fetch,
        }),
      ),
    );

    await Effect.runPromise(program);

    expect(sessionCookie).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    const firstHeaders = new Headers(fetch.mock.calls[0]?.[1]?.headers);
    const secondHeaders = new Headers(fetch.mock.calls[1]?.[1]?.headers);
    expect(firstHeaders.get("cookie")).toBe("better-auth.session_token=first-session");
    expect(secondHeaders.get("cookie")).toBe("better-auth.session_token=refreshed-session");
  });

  it("fails closed before sending when a valid session cookie is unavailable", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const delivery = yield* TelemetryDelivery;
        return yield* delivery.send(envelope);
      }).pipe(
        Effect.provide(
          telemetryTransportLayer({
            endpoint: "https://studienbuch.test/api/observability/v1/telemetry",
            sessionCookie: async () => "not-a-cookie",
            fetch,
          }),
        ),
      ),
    );

    expect(result).toEqual({
      status: "failed",
      reason: "Authenticated telemetry authority is unavailable",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
