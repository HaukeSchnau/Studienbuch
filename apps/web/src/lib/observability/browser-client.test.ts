import { decodeClientTelemetryEnvelope } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vitest";
import {
  createBrowserTelemetryClient,
  type BrowserFetch,
  type BrowserTelemetryEnvironment,
} from "./browser-client.ts";

function fixture(options?: {
  readonly fetch?: BrowserTelemetryEnvironment["fetch"];
  readonly maximumRecords?: number;
  readonly maximumBytes?: number;
}) {
  let now = 1_000;
  let randomValue = 1;
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const fetchMock =
    options?.fetch ?? vi.fn<BrowserFetch>(async () => new Response(null, { status: 202 }));
  const sendBeacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
  const environment: BrowserTelemetryEnvironment = {
    origin: "https://studienbuch.test",
    fetch: fetchMock,
    sendBeacon,
    now: () => now,
    randomBytes(length) {
      const bytes = new Uint8Array(length);
      bytes.fill(randomValue++ % 255);
      return bytes;
    },
    setTimeout(callback) {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const client = createBrowserTelemetryClient({
    environment,
    serviceVersion: "test-version",
    deploymentEnvironment: "test",
    maximumRecords: options?.maximumRecords,
    maximumBytes: options?.maximumBytes,
  });
  return {
    client,
    fetchMock,
    sendBeacon,
    advanceBy: (milliseconds: number) => {
      now += milliseconds;
    },
  };
}

async function envelopeFromFetch(fetchMock: BrowserTelemetryEnvironment["fetch"], call = 0) {
  const mock = vi.mocked(fetchMock);
  const [, init] = mock.mock.calls[call] ?? [];
  const body = init?.body;
  expect(body).toBeTypeOf("string");
  const parsed = JSON.parse(await new Response(body).text());
  return Effect.runPromise(decodeClientTelemetryEnvelope(parsed));
}

describe("browser operational telemetry", () => {
  it("does not emit an empty lifecycle flush", async () => {
    const { client, fetchMock, sendBeacon } = fixture();

    await expect(client.flush({ preferBeacon: true })).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("delivers the strict shared envelope only to the same-origin server ingress", async () => {
    const { client, fetchMock } = fixture();
    client.recordCanary();

    await expect(client.flush()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetchMock).mock.calls[0] ?? [];
    expect(url).toBe("https://studienbuch.test/api/observability/v1/telemetry");
    expect(init).toMatchObject({ credentials: "same-origin", keepalive: true, method: "POST" });
    const envelope = await envelopeFromFetch(fetchMock);
    expect(envelope.serviceName).toBe("studienbuch-web-client");
    expect(envelope.records.map((record) => record.type)).toContain("span");
    expect(JSON.stringify(envelope)).not.toContain("4318");
  });

  it("propagates W3C context only to observed same-origin GET and POST requests", async () => {
    const requestFetch = vi.fn<BrowserFetch>(async () => new Response(null, { status: 200 }));
    const { client } = fixture({ fetch: requestFetch });

    await client.fetch("https://studienbuch.test/api/tasks", { method: "GET" });
    const sameOriginHeaders = new Headers(vi.mocked(requestFetch).mock.calls[0]?.[1]?.headers);
    expect(sameOriginHeaders.get("traceparent")).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);

    await client.fetch("https://example.test/api", { method: "GET" });
    const crossOriginHeaders = new Headers(vi.mocked(requestFetch).mock.calls[1]?.[1]?.headers);
    expect(crossOriginHeaders.has("traceparent")).toBe(false);
  });

  it("bounds memory, backs off failures, and reports dropped records without free text", async () => {
    const deliveryFetch = vi
      .fn<BrowserFetch>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValue(new Response(null, { status: 202 }));
    const { client, advanceBy, fetchMock } = fixture({ fetch: deliveryFetch, maximumRecords: 2 });
    client.recordCanary();
    client.recordNavigation(12, "/students/Alice-Sensitive");
    expect(client.snapshot().queuedRecords).toBe(2);
    expect(client.snapshot().pendingDrops).toBeGreaterThan(0);

    await expect(client.flush()).resolves.toBe(false);
    expect(client.snapshot().consecutiveFailures).toBe(1);
    expect(client.snapshot().queuedRecords).toBeLessThanOrEqual(2);

    advanceBy(1_000);
    await expect(client.flush()).resolves.toBe(true);
    const envelope = await envelopeFromFetch(fetchMock, 1);
    expect(envelope.records).toContainEqual(
      expect.objectContaining({ name: "studienbuch_client_outbox_dropped_total" }),
    );
    expect(JSON.stringify(envelope)).not.toContain("Alice-Sensitive");
  });

  it("uses a content-typed beacon for lifecycle best-effort delivery", async () => {
    const { client, fetchMock, sendBeacon } = fixture();
    client.recordCanary();

    await expect(client.flush({ preferBeacon: true })).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeacon).toHaveBeenCalledOnce();
    const call = sendBeacon.mock.calls[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    const [url, body] = call;
    expect(url).toBe("https://studienbuch.test/api/observability/v1/telemetry");
    expect(body.type).toBe("application/json");
  });
});
