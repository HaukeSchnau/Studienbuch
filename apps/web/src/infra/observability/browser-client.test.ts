import { decodeClientTelemetryEnvelope } from "@stu/observability/browser";
import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vitest";
import {
  createBrowserTelemetryClient,
  type BrowserFetch,
  type BrowserTelemetryEnvironment,
} from "./browser-client.ts";

const accepted = (count: number) =>
  new Response(JSON.stringify({ acceptedRecords: count }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });

const acceptAll: BrowserFetch = async (_input, init) => {
  const body = init?.body;
  if (body === undefined || body === null) return accepted(0);
  const parsed: unknown = JSON.parse(await new Response(body).text());
  const envelope = await Effect.runPromise(decodeClientTelemetryEnvelope(parsed));
  return accepted(envelope.records.length);
};

function fixture(options?: {
  readonly fetch?: BrowserTelemetryEnvironment["fetch"];
  readonly maximumRecords?: number;
  readonly maximumBytes?: number;
}) {
  let now = 1_000;
  let randomValue = 1;
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const fetchMock = options?.fetch ?? vi.fn<BrowserFetch>(acceptAll);
  const sendBeacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);
  const environment: BrowserTelemetryEnvironment = {
    origin: "https://studienbuch.test",
    fetch: fetchMock,
    sendBeacon,
    now: () => now,
    random: () => 0.5,
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
    instanceId: "test-instance",
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
  expect(body).toBeDefined();
  const parsed: unknown = JSON.parse(await new Response(body).text());
  return Effect.runPromise(decodeClientTelemetryEnvelope(parsed));
}

function decodeEnvelopeText(text: string) {
  const parsed: unknown = JSON.parse(text);
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
    const requestedUrl = url instanceof URL ? url.href : url instanceof Request ? url.url : url;
    expect(requestedUrl).toBe("https://studienbuch.test/api/observability/v1/telemetry");
    expect(init).toMatchObject({ credentials: "same-origin", keepalive: true, method: "POST" });
    const envelope = await envelopeFromFetch(fetchMock);
    expect(envelope.serviceName).toBe("studienbuch-web-client");
    expect(envelope.serviceVersion).toBe("test-version");
    expect(envelope.instanceId).toBe("test-instance");
    expect(JSON.stringify(envelope)).not.toContain("4318");
  });

  it("treats a missing or malformed acknowledgement as a failed delivery", async () => {
    const unacknowledged = vi
      .fn<BrowserFetch>()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockImplementation(acceptAll);
    const { client, advanceBy } = fixture({ fetch: unacknowledged });
    client.recordCanary();

    // The ingress promises `{ acceptedRecords }`; a bare 202 means the two sides disagree, and
    // guessing "everything landed" would silently lose records.
    await expect(client.flush()).resolves.toBe(false);

    advanceBy(5_000);
    await expect(client.flush()).resolves.toBe(true);
  });

  it("rejects an acknowledgement larger than the submitted batch", async () => {
    const overacknowledged = vi.fn<BrowserFetch>(async () => accepted(101));
    const { client } = fixture({ fetch: overacknowledged });
    client.recordCanary();

    await expect(client.flush()).resolves.toBe(false);
  });

  it("retries only the unacknowledged remainder of a partially accepted batch", async () => {
    const partial = vi
      .fn<BrowserFetch>()
      .mockResolvedValueOnce(accepted(1))
      .mockImplementation(acceptAll);
    const { client, advanceBy } = fixture({ fetch: partial });
    client.recordCanary();

    await expect(client.flush()).resolves.toBe(true);
    advanceBy(5_000);
    await expect(client.flush()).resolves.toBe(true);

    const retried = await envelopeFromFetch(partial, 1);
    expect(retried.records.length).toBeGreaterThan(0);
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

  it("preserves Effect HTTP context so RPC client and server spans stay in one trace", async () => {
    const requestFetch = vi.fn<BrowserFetch>(async () => new Response(null, { status: 200 }));
    const { client } = fixture({ fetch: requestFetch });
    const traceparent = "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01";

    await client.fetch("https://studienbuch.test/api/rpc", {
      method: "POST",
      headers: { traceparent },
    });

    const headers = new Headers(vi.mocked(requestFetch).mock.calls[0]?.[1]?.headers);
    expect(headers.get("traceparent")).toBe(traceparent);
  });

  it("bounds memory and reports drops without leaking the paths that caused them", async () => {
    const { client, sendBeacon } = fixture({ maximumRecords: 2 });
    client.recordCanary();
    client.recordNavigation(12, "/students/Alice-Sensitive");
    client.recordNavigation(13, "/students/Bob-Sensitive");

    await expect(client.flush({ preferBeacon: true })).resolves.toBe(true);
    const blob = sendBeacon.mock.calls[0]?.[1];
    expect(blob).toBeDefined();
    if (blob === undefined) return;
    const envelope = await decodeEnvelopeText(await blob.text());
    expect(envelope.records).toContainEqual(
      expect.objectContaining({ name: "studienbuch_client_outbox_dropped_total" }),
    );
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain("Alice-Sensitive");
    expect(serialized).not.toContain("Bob-Sensitive");
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
