import type {
  ClientTelemetryEnvelopeType,
  ClientTelemetryRecordType,
  DeploymentEnvironment,
} from "@stu/observability/browser";

const telemetryPath = "/api/observability/v1/telemetry";
const defaultMaximumRecords = 48;
const defaultMaximumBytes = 32 * 1_024;
const defaultFlushDelayMillis = 2_000;
const maximumBackoffMillis = 60_000;

type ScreenName = "overview" | "schedule" | "tasks" | "courses" | "profile" | "setup";

interface KnownRouteAttribute {
  readonly "http.route"?: "/" | typeof telemetryPath;
}

interface ScreenAttribute {
  readonly "screen.name"?: ScreenName;
}

export interface BrowserTelemetryEnvironment {
  readonly origin: string;
  readonly fetch: BrowserFetch;
  readonly sendBeacon?: (url: string, data: Blob) => boolean;
  readonly now: () => number;
  readonly randomBytes: (length: number) => Uint8Array;
  readonly setTimeout: (callback: () => void, delay: number) => number;
  readonly clearTimeout: (timer: number) => void;
}

export type BrowserFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface BrowserTelemetrySnapshot {
  readonly queuedRecords: number;
  readonly queuedBytes: number;
  readonly pendingDrops: number;
  readonly consecutiveFailures: number;
  readonly nextAttemptAt: number;
}

export interface BrowserTelemetryClient {
  readonly recordCanary: () => void;
  readonly recordNavigation: (durationMillis: number, pathname: string) => void;
  readonly recordRender: (durationMillis: number, pathname: string) => void;
  readonly fetch: BrowserFetch;
  readonly flush: (options?: { readonly preferBeacon?: boolean }) => Promise<boolean>;
  readonly snapshot: () => BrowserTelemetrySnapshot;
}

interface QueuedRecord {
  readonly bytes: number;
  readonly record: ClientTelemetryRecordType;
}

export function createBrowserTelemetryClient(options: {
  readonly environment: BrowserTelemetryEnvironment;
  readonly serviceVersion: string;
  readonly deploymentEnvironment: DeploymentEnvironment;
  readonly maximumRecords?: number;
  readonly maximumBytes?: number;
  readonly flushDelayMillis?: number;
}): BrowserTelemetryClient {
  const environment = options.environment;
  const endpoint = new URL(telemetryPath, environment.origin).href;
  const maximumRecords = options.maximumRecords ?? defaultMaximumRecords;
  const maximumBytes = options.maximumBytes ?? defaultMaximumBytes;
  const flushDelayMillis = options.flushDelayMillis ?? defaultFlushDelayMillis;
  const serviceVersion = normalizeServiceVersion(options.serviceVersion);
  const queue: QueuedRecord[] = [];
  let queuedBytes = 0;
  let pendingDrops = 0;
  let consecutiveFailures = 0;
  let nextAttemptAt = 0;
  let scheduledFlush: number | undefined;
  let activeFlush: Promise<boolean> | undefined;

  const scheduleFlush = (delay = flushDelayMillis) => {
    if (scheduledFlush !== undefined) return;
    scheduledFlush = environment.setTimeout(() => {
      scheduledFlush = undefined;
      void flush();
    }, delay);
  };

  const enqueue = (record: ClientTelemetryRecordType) => {
    const bytes = encodedLength(record);
    if (bytes > maximumBytes) {
      pendingDrops += 1;
      return;
    }
    while (
      queue.length > 0 &&
      (queue.length >= maximumRecords || queuedBytes + bytes > maximumBytes)
    ) {
      const dropped = queue.shift();
      if (dropped !== undefined) {
        queuedBytes -= dropped.bytes;
        pendingDrops += 1;
      }
    }
    queue.push({ bytes, record });
    queuedBytes += bytes;
    scheduleFlush();
  };

  const restore = (records: readonly QueuedRecord[]) => {
    for (const item of [...records].reverse()) {
      queue.unshift(item);
      queuedBytes += item.bytes;
    }
    while (queue.length > maximumRecords || queuedBytes > maximumBytes) {
      const dropped = queue.shift();
      if (dropped !== undefined) {
        queuedBytes -= dropped.bytes;
        pendingDrops += 1;
      }
    }
  };

  const flush = (flushOptions?: { readonly preferBeacon?: boolean }): Promise<boolean> => {
    if (activeFlush !== undefined) return activeFlush;
    activeFlush = flushOnce(flushOptions).finally(() => {
      activeFlush = undefined;
    });
    return activeFlush;
  };

  const flushOnce = async (flushOptions?: { readonly preferBeacon?: boolean }) => {
    if (environment.now() < nextAttemptAt && !flushOptions?.preferBeacon) {
      scheduleFlush(nextAttemptAt - environment.now());
      return false;
    }
    if (scheduledFlush !== undefined) {
      environment.clearTimeout(scheduledFlush);
      scheduledFlush = undefined;
    }
    if (queue.length === 0 && pendingDrops === 0) return true;

    const batch = queue.splice(0, queue.length);
    queuedBytes = 0;
    const dropsInBatch = pendingDrops;
    const flushTraceId = randomHex(environment, 16);
    const flushSpanId = randomHex(environment, 8);
    const startedAt = environment.now();
    const records = batch.map((item) => item.record);
    if (dropsInBatch > 0) {
      records.push({
        type: "metric",
        name: "studienbuch_client_outbox_dropped_total",
        kind: "counter",
        value: dropsInBatch,
        recordedAtUnixMillis: startedAt,
        attributes: { operation: "telemetry.flush", platform: "web", signal: "all" },
      });
    }
    records.push({
      type: "span",
      name: "client.telemetry.flush",
      traceId: flushTraceId,
      spanId: flushSpanId,
      startedAtUnixMillis: startedAt,
      durationMillis: 0,
      status: "unset",
      attributes: {
        "app.operation": "telemetry.flush",
        "http.method": "POST",
        "http.route": telemetryPath,
        "telemetry.priority": "low",
      },
    });

    const envelope: ClientTelemetryEnvelopeType = {
      schemaVersion: 1,
      serviceName: "studienbuch-web-client",
      serviceVersion,
      environment: options.deploymentEnvironment,
      sentAtUnixMillis: startedAt,
      records,
    };
    const body = JSON.stringify(envelope);

    let delivered = false;
    try {
      if (flushOptions?.preferBeacon && environment.sendBeacon !== undefined) {
        delivered = environment.sendBeacon(
          endpoint,
          new Blob([body], { type: "application/json" }),
        );
      } else {
        const response = await environment.fetch(endpoint, {
          method: "POST",
          body,
          credentials: "same-origin",
          keepalive: true,
          headers: {
            "content-type": "application/json",
            traceparent: `00-${flushTraceId}-${flushSpanId}-01`,
          },
        });
        delivered = response.ok;
      }
    } catch {
      delivered = false;
    }

    const durationMillis = Math.max(0, environment.now() - startedAt);
    if (delivered) {
      pendingDrops = Math.max(0, pendingDrops - dropsInBatch);
      consecutiveFailures = 0;
      nextAttemptAt = 0;
      return true;
    }

    restore(batch);
    consecutiveFailures += 1;
    const backoffMillis = Math.min(maximumBackoffMillis, 1_000 * 2 ** (consecutiveFailures - 1));
    nextAttemptAt = environment.now() + backoffMillis;
    enqueueRequestDuration(durationMillis, "failure");
    enqueue({
      type: "log",
      event: "client.request.failed",
      severity: "warn",
      occurredAtUnixMillis: environment.now(),
      traceId: flushTraceId,
      spanId: flushSpanId,
      attributes: {
        "app.operation": "telemetry.flush",
        "error.type": "network",
        "http.method": "POST",
        "http.route": telemetryPath,
        outcome: "failure",
        "telemetry.priority": "normal",
      },
    });
    scheduleFlush(backoffMillis);
    return false;
  };

  const enqueueRequestDuration = (durationMillis: number, outcome: "success" | "failure") => {
    enqueue({
      type: "metric",
      name: "studienbuch_client_request_duration_ms",
      kind: "histogram",
      value: durationMillis,
      recordedAtUnixMillis: environment.now(),
      attributes: { operation: "telemetry.flush", outcome, platform: "web" },
    });
  };

  const observedFetch: BrowserFetch = async (input, init) => {
    const url = requestUrl(input, environment.origin);
    const method = requestMethod(input, init);
    if (url.origin !== environment.origin || (method !== "GET" && method !== "POST")) {
      return environment.fetch(input, init);
    }

    const traceId = randomHex(environment, 16);
    const spanId = randomHex(environment, 8);
    const startedAt = environment.now();
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("traceparent", `00-${traceId}-${spanId}-01`);

    const request = environment.fetch(input, { ...init, headers });
    void request.catch(() => {
      enqueueRequestSpan(traceId, spanId, startedAt, method, url.pathname, "failure");
      enqueueRequestDuration(Math.max(0, environment.now() - startedAt), "failure");
      enqueueRequestFailure(
        traceId,
        spanId,
        method,
        url.pathname,
        init?.signal?.aborted ? "timeout" : "network",
      );
    });
    const response = await request;
    const outcome = response.ok ? "success" : "failure";
    enqueueRequestSpan(traceId, spanId, startedAt, method, url.pathname, outcome);
    enqueueRequestDuration(Math.max(0, environment.now() - startedAt), outcome);
    if (!response.ok) enqueueRequestFailure(traceId, spanId, method, url.pathname, "unknown");
    return response;
  };

  const enqueueRequestSpan = (
    traceId: string,
    spanId: string,
    startedAtUnixMillis: number,
    method: "GET" | "POST",
    pathname: string,
    outcome: "success" | "failure",
  ) => {
    enqueue({
      type: "span",
      name: "client.request",
      traceId,
      spanId,
      startedAtUnixMillis,
      durationMillis: Math.max(0, environment.now() - startedAtUnixMillis),
      status: outcome === "success" ? "ok" : "error",
      attributes: {
        "app.operation": "request",
        "http.method": method,
        ...knownRoute(pathname),
        outcome,
        "telemetry.priority": outcome === "success" ? "low" : "high",
      },
    });
  };

  const enqueueRequestFailure = (
    traceId: string,
    spanId: string,
    method: "GET" | "POST",
    pathname: string,
    errorType: "network" | "timeout" | "unknown",
  ) => {
    enqueue({
      type: "log",
      event: "client.request.failed",
      severity: "warn",
      occurredAtUnixMillis: environment.now(),
      traceId,
      spanId,
      attributes: {
        "app.operation": "request",
        "error.type": errorType,
        "http.method": method,
        ...knownRoute(pathname),
        outcome: "failure",
        "telemetry.priority": "high",
      },
    });
  };

  return {
    recordCanary() {
      enqueue({
        type: "log",
        event: "client.telemetry.canary",
        severity: "info",
        occurredAtUnixMillis: environment.now(),
        attributes: { "telemetry.priority": "low" },
      });
      enqueue({
        type: "metric",
        name: "studienbuch_client_canary_total",
        kind: "counter",
        value: 1,
        recordedAtUnixMillis: environment.now(),
        attributes: { platform: "web", signal: "all" },
      });
    },
    recordNavigation(durationMillis, pathname) {
      const ids = { traceId: randomHex(environment, 16), spanId: randomHex(environment, 8) };
      enqueue({
        type: "span",
        name: "client.navigation",
        ...ids,
        startedAtUnixMillis: Math.max(0, environment.now() - durationMillis),
        durationMillis: Math.max(0, durationMillis),
        status: "ok",
        attributes: {
          "app.operation": "navigation",
          ...screenAttribute(pathname),
          outcome: "success",
          "telemetry.priority": "normal",
        },
      });
    },
    recordRender(durationMillis, pathname) {
      const ids = { traceId: randomHex(environment, 16), spanId: randomHex(environment, 8) };
      enqueue({
        type: "span",
        name: "client.render",
        ...ids,
        startedAtUnixMillis: Math.max(0, environment.now() - durationMillis),
        durationMillis: Math.max(0, durationMillis),
        status: "ok",
        attributes: {
          "app.operation": "render",
          ...screenAttribute(pathname),
          outcome: "success",
          "telemetry.priority": "normal",
        },
      });
    },
    fetch: observedFetch,
    flush,
    snapshot: () => ({
      queuedRecords: queue.length,
      queuedBytes,
      pendingDrops,
      consecutiveFailures,
      nextAttemptAt,
    }),
  };
}

function encodedLength(record: ClientTelemetryRecordType): number {
  return new TextEncoder().encode(JSON.stringify(record)).byteLength;
}

function normalizeServiceVersion(version: string): string {
  const normalized = version.trim().slice(0, 128);
  return normalized.length > 0 ? normalized : "development";
}

function randomHex(environment: BrowserTelemetryEnvironment, byteLength: number): string {
  return Array.from(environment.randomBytes(byteLength), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function requestUrl(input: RequestInfo | URL, origin: string): URL {
  if (input instanceof Request) return new URL(input.url);
  return new URL(String(input), origin);
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): "GET" | "POST" | "other" {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return method === "GET" || method === "POST" ? method : "other";
}

function knownRoute(pathname: string): KnownRouteAttribute {
  if (pathname === "/") return { "http.route": "/" };
  if (pathname === telemetryPath) return { "http.route": telemetryPath };
  return {};
}

function screenAttribute(pathname: string): ScreenAttribute {
  const segment = pathname.split("/", 2)[1];
  switch (segment) {
    case "schedule":
    case "tasks":
    case "courses":
    case "profile":
    case "setup":
      return { "screen.name": segment };
    default:
      return { "screen.name": "overview" };
  }
}

function browserEnvironment(): BrowserTelemetryEnvironment {
  return {
    origin: window.location.origin,
    fetch: window.fetch.bind(window),
    sendBeacon:
      navigator.sendBeacon === undefined ? undefined : navigator.sendBeacon.bind(navigator),
    now: Date.now,
    randomBytes(length) {
      return crypto.getRandomValues(new Uint8Array(length));
    },
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
  };
}

const clientKey = Symbol.for("@stu/web/browser-telemetry-client");
const lifecycleKey = Symbol.for("@stu/web/browser-telemetry-lifecycle");
const browserGlobal = globalThis as typeof globalThis & { [clientKey]?: BrowserTelemetryClient };
const lifecycleGlobal = globalThis as typeof globalThis & { [lifecycleKey]?: () => void };

/**
 * The process-wide browser telemetry client, created on first use.
 *
 * Identity and environment come from the server's public runtime configuration rather than from
 * `import.meta.env`, so a release reports its real version instead of whatever the build machine
 * happened to know.
 */
export function browserTelemetry(identity: {
  readonly serviceVersion: string;
  readonly deploymentEnvironment: DeploymentEnvironment;
}): BrowserTelemetryClient | undefined {
  if (globalThis.window === undefined) return undefined;
  return (browserGlobal[clientKey] ??= createBrowserTelemetryClient({
    environment: browserEnvironment(),
    serviceVersion: identity.serviceVersion,
    deploymentEnvironment: identity.deploymentEnvironment,
  }));
}

export function installBrowserTelemetryLifecycle(client: BrowserTelemetryClient): () => void {
  if (lifecycleGlobal[lifecycleKey] !== undefined) return () => undefined;
  const flushWithBeacon = () => void client.flush({ preferBeacon: true });
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") flushWithBeacon();
  };
  const onOnline = () => void client.flush();
  window.addEventListener("pagehide", flushWithBeacon);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibilityChange);
  const remove = () => {
    window.removeEventListener("pagehide", flushWithBeacon);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (lifecycleGlobal[lifecycleKey] === remove) delete lifecycleGlobal[lifecycleKey];
  };
  lifecycleGlobal[lifecycleKey] = remove;
  return remove;
}
