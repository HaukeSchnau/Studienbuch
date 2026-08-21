import type { ClientTelemetryEnvelope } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";
import { describe, expect, it, vi } from "vitest";
import { ClientTelemetry } from "#/infra/observability/client-telemetry.server.ts";
import type { RouteEffectRunner } from "#/infra/runtime/request.server.ts";
import {
  makeTelemetryIngressHandler,
  maximumTelemetryBodyBytes,
  telemetryRoute,
} from "./ingress.server.ts";
import { makeTelemetryAdmission } from "./admission.server.ts";

const validEnvelope = {
  schemaVersion: 1,
  serviceName: "studienbuch-web-client",
  serviceVersion: "test",
  environment: "test",
  sentAtUnixMillis: 1,
  records: [
    {
      type: "log",
      event: "client.telemetry.canary",
      severity: "info",
      occurredAtUnixMillis: 1,
      attributes: { "telemetry.priority": "high" },
    },
  ],
} satisfies ClientTelemetryEnvelope;

function request(body: BodyInit = JSON.stringify(validEnvelope), headers?: HeadersInit) {
  return new Request(`https://studienbuch.test${telemetryRoute}`, {
    method: "POST",
    body,
    headers: headers ?? {
      origin: "https://studienbuch.test",
      "content-type": "application/json",
    },
  });
}

/** A native client: no `Origin`, but a session the server can resolve. */
function nativeRequest(body: BodyInit = JSON.stringify(validEnvelope)) {
  return new Request(`https://studienbuch.test${telemetryRoute}`, {
    method: "POST",
    body,
    headers: { "content-type": "application/json", authorization: "Bearer session-token" },
  });
}

function fixture(options?: { readonly limit?: number; readonly userId?: string }) {
  const ingest = vi.fn(() => Effect.void);
  const run: RouteEffectRunner = (effect) =>
    Effect.runPromiseExit(
      effect.pipe(
        Effect.provideService(ClientTelemetry, { ingest }),
        Effect.provide(OtlpExporter.layerFlusher),
      ),
    );
  const handler = makeTelemetryIngressHandler({
    admission: makeTelemetryAdmission({
      authority: async () => options?.userId,
      limit: options?.limit ?? 60,
      now: () => 1_000,
    }),
    run,
  });
  return { handler, ingest, run };
}

describe("public telemetry ingress", () => {
  it("accepts a same-origin browser envelope and acknowledges the record count", async () => {
    const { handler, ingest } = fixture();
    const response = await handler(request());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ acceptedRecords: 1 });
    expect(ingest).toHaveBeenCalledOnce();
  });

  it("admits a native client on its session, which sends no Origin header", async () => {
    const { handler, ingest } = fixture({ userId: "user-1" });
    const response = await handler(nativeRequest());

    // The origin-only policy this replaced rejected every native envelope with 403, which is why
    // the mobile channel could never be switched on.
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ acceptedRecords: 1 });
    expect(ingest).toHaveBeenCalledOnce();
  });

  it("refuses a client that is neither same-origin nor authenticated", async () => {
    const { handler, ingest } = fixture();
    const response = await handler(nativeRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "admission_denied" });
    expect(ingest).not.toHaveBeenCalled();
  });

  it.each([
    ["cross origin", { origin: "https://attacker.test" }, 403, "admission_denied"],
    ["wrong content type", { "content-type": "text/plain" }, 415, "unsupported_content_type"],
    ["compressed", { "content-encoding": "gzip" }, 415, "compressed_body_not_supported"],
    ["invalid length", { "content-length": "nope" }, 400, "invalid_content_length"],
    [
      "declared oversized",
      { "content-length": String(maximumTelemetryBodyBytes + 1) },
      413,
      "payload_too_large",
    ],
  ])("rejects %s requests", async (_name, headerValues, status, error) => {
    const { handler } = fixture();
    const headers = new Headers({
      origin: "https://studienbuch.test",
      "content-type": "application/json",
    });
    for (const [key, value] of Object.entries(headerValues)) headers.set(key, value);
    const response = await handler(request(JSON.stringify(validEnvelope), headers));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("enforces the actual streamed byte limit", async () => {
    const { handler } = fixture();
    const response = await handler(request("x".repeat(maximumTelemetryBodyBytes + 1)));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "payload_too_large" });
  });

  it("rejects malformed JSON and schema excess properties", async () => {
    const { handler } = fixture();
    const malformed = await handler(request("{"));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "invalid_json" });

    const invalid = await handler(
      request(JSON.stringify({ ...validEnvelope, studentName: "must never be accepted" })),
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "invalid_telemetry_envelope" });
  });

  it("rate limits per principal so one noisy client cannot starve the rest", async () => {
    const { handler } = fixture({ limit: 1, userId: "user-1" });

    expect((await handler(request())).status).toBe(202);
    const limited = await handler(request());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");

    // A different principal has its own window; the previous single global window did not.
    expect((await handler(nativeRequest())).status).toBe(202);
  });
});
