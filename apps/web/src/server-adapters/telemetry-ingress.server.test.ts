import type { ClientTelemetryEnvelopeType } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import * as OtlpExporter from "effect/unstable/observability/OtlpExporter";
import { describe, expect, it, vi } from "vitest";
import { ClientTelemetry } from "../server-runtime/client-telemetry.server.ts";
import type { RouteEffectRunner } from "../server-runtime/request.server.ts";
import {
  makeTelemetryIngressHandler,
  maximumTelemetryBodyBytes,
  telemetryRoute,
} from "./telemetry-ingress.server.ts";
import { makeTelemetryIngressPolicy } from "./telemetry-policy.server.ts";

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
} satisfies ClientTelemetryEnvelopeType;

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

function fixture(options?: { readonly limit?: number }) {
  const ingest = vi.fn(() => Effect.void);
  const run: RouteEffectRunner = (effect) =>
    Effect.runPromiseExit(
      effect.pipe(
        Effect.provideService(ClientTelemetry, { ingest }),
        Effect.provide(OtlpExporter.layerFlusher),
      ),
    );
  const handler = makeTelemetryIngressHandler({
    policy: makeTelemetryIngressPolicy({ limit: options?.limit ?? 60, now: () => 1_000 }),
    run,
  });
  return { handler, ingest, run };
}

describe("public telemetry ingress", () => {
  it("accepts a strict same-origin envelope", async () => {
    const { handler, ingest } = fixture();
    const response = await handler(request());

    expect(response.status).toBe(202);
    expect(ingest).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing origin", { origin: undefined }, 403, "same_origin_required"],
    ["cross origin", { origin: "https://attacker.test" }, 403, "same_origin_required"],
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
    for (const [key, value] of Object.entries(headerValues)) {
      if (value === undefined) headers.delete(key);
      else headers.set(key, value);
    }
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

  it("provides a bounded rate-limit seam", async () => {
    const { handler } = fixture({ limit: 1 });
    expect((await handler(request())).status).toBe(202);
    const limited = await handler(request());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
