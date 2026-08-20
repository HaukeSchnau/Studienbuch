import {
  TelemetryOutbox,
  decodeClientTelemetryAcknowledgement,
  memoryTelemetryStorage,
  type ClientTelemetryEnvelopeType,
  type ClientTelemetryRecordType,
  type DeploymentEnvironment,
  type TelemetryDelivery,
  type TelemetryPriority,
  clientMetricNames,
  httpRoutes,
  screenNames,
} from "@stu/observability/browser";
import * as Option from "effect/Option";
import { webClientServiceName } from "#/project.ts";

const telemetryPath = "/api/observability/v1/telemetry";
const defaultMaximumRecords = 48;
const defaultMaximumBytes = 32 * 1_024;
const defaultFlushDelayMillis = 2_000;

interface KnownRouteAttribute {
  readonly "http.route"?: (typeof httpRoutes)[number];
}

interface ScreenAttribute {
  readonly "screen.name"?: (typeof screenNames)[number];
}

export type BrowserFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface BrowserTelemetryEnvironment {
  readonly origin: string;
  readonly fetch: BrowserFetch;
  readonly sendBeacon?: (url: string, data: Blob) => boolean;
  readonly now: () => number;
  readonly random: () => number;
  readonly randomBytes: (length: number) => Uint8Array;
  readonly setTimeout: (callback: () => void, delay: number) => number;
  readonly clearTimeout: (timer: number) => void;
}

export interface BrowserTelemetryClient {
  readonly recordCanary: () => void;
  readonly recordNavigation: (durationMillis: number, pathname: string) => void;
  readonly recordRender: (durationMillis: number, pathname: string) => void;
  readonly fetch: BrowserFetch;
  readonly flush: (options?: { readonly preferBeacon?: boolean }) => Promise<boolean>;
}

/**
 * Delivers an envelope to the same-origin ingress, decoding the shared acknowledgement so partial
 * acceptance leaves the remainder queued rather than dropping it.
 */
function browserDelivery(
  environment: BrowserTelemetryEnvironment,
  endpoint: string,
): TelemetryDelivery {
  return {
    send: async (envelope) => {
      const response = await environment.fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(envelope),
        credentials: "same-origin",
        keepalive: true,
        headers: { "content-type": "application/json" },
      });
      if (!response.ok) {
        return { status: "failed", reason: `ingress rejected the batch (${response.status})` };
      }
      const body: unknown = await response.json().catch(() => undefined);
      const acknowledgement = decodeClientTelemetryAcknowledgement(body, {
        onExcessProperty: "error",
      });
      return Option.isSome(acknowledgement)
        ? { status: "sent", accepted: acknowledgement.value.acceptedRecords }
        : { status: "failed", reason: "ingress returned an invalid acknowledgement" };
    },
    sendBeacon:
      environment.sendBeacon === undefined
        ? undefined
        : (envelope: ClientTelemetryEnvelopeType) =>
            environment.sendBeacon?.(
              endpoint,
              new Blob([JSON.stringify(envelope)], { type: "application/json" }),
            ) ?? false,
  };
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
  const flushDelayMillis = options.flushDelayMillis ?? defaultFlushDelayMillis;
  const outbox = new TelemetryOutbox({
    storage: memoryTelemetryStorage(),
    delivery: browserDelivery(environment, endpoint),
    clock: { now: environment.now },
    random: { next: environment.random },
    serviceName: webClientServiceName,
    serviceVersion: normalizeServiceVersion(options.serviceVersion),
    environment: options.deploymentEnvironment,
    platform: "web",
    maxRecords: options.maximumRecords ?? defaultMaximumRecords,
    maxBytes: options.maximumBytes ?? defaultMaximumBytes,
  });

  let scheduledFlush: number | undefined;

  const scheduleFlush = () => {
    if (scheduledFlush !== undefined) return;
    scheduledFlush = environment.setTimeout(() => {
      scheduledFlush = undefined;
      void flush();
    }, flushDelayMillis);
  };

  const enqueue = (record: ClientTelemetryRecordType, priority: TelemetryPriority) => {
    void outbox.enqueue(record, priority);
    scheduleFlush();
  };

  const flush = async (flushOptions?: { readonly preferBeacon?: boolean }) => {
    if (scheduledFlush !== undefined) {
      environment.clearTimeout(scheduledFlush);
      scheduledFlush = undefined;
    }
    const result = await outbox.flush({ preferBeacon: flushOptions?.preferBeacon });
    if (result.status === "failed") scheduleFlush();
    return result.status === "sent" || result.status === "empty";
  };

  const enqueueRequestSpan = (
    traceId: string,
    spanId: string,
    startedAtUnixMillis: number,
    method: "GET" | "POST",
    pathname: string,
    outcome: "success" | "failure",
  ) => {
    enqueue(
      {
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
      },
      outcome === "success" ? "low" : "high",
    );
  };

  const enqueueRequestFailure = (
    traceId: string,
    spanId: string,
    method: "GET" | "POST",
    pathname: string,
    errorType: "network" | "timeout" | "unknown",
  ) => {
    enqueue(
      {
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
      },
      "high",
    );
  };

  const enqueueRequestDuration = (durationMillis: number, outcome: "success" | "failure") => {
    enqueue(
      {
        type: "metric",
        name: clientMetricNames.requestDuration,
        kind: "histogram",
        value: durationMillis,
        recordedAtUnixMillis: environment.now(),
        attributes: { operation: "request", outcome, platform: "web" },
      },
      "low",
    );
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

  const timedSpan = (
    name: "client.navigation" | "client.render",
    operation: "navigation" | "render",
    durationMillis: number,
    pathname: string,
  ) => {
    enqueue(
      {
        type: "span",
        name,
        traceId: randomHex(environment, 16),
        spanId: randomHex(environment, 8),
        startedAtUnixMillis: Math.max(0, environment.now() - durationMillis),
        durationMillis: Math.max(0, durationMillis),
        status: "ok",
        attributes: {
          "app.operation": operation,
          ...screenAttribute(pathname),
          outcome: "success",
          "telemetry.priority": "normal",
        },
      },
      "normal",
    );
  };

  return {
    recordCanary() {
      enqueue(
        {
          type: "log",
          event: "client.telemetry.canary",
          severity: "info",
          occurredAtUnixMillis: environment.now(),
          attributes: { "telemetry.priority": "low" },
        },
        "low",
      );
      enqueue(
        {
          type: "metric",
          name: clientMetricNames.canaryTotal,
          kind: "counter",
          value: 1,
          recordedAtUnixMillis: environment.now(),
          attributes: { platform: "web", signal: "all" },
        },
        "low",
      );
    },
    recordNavigation: (durationMillis, pathname) =>
      timedSpan("client.navigation", "navigation", durationMillis, pathname),
    recordRender: (durationMillis, pathname) =>
      timedSpan("client.render", "render", durationMillis, pathname),
    fetch: observedFetch,
    flush,
  };
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

/**
 * Both allowlists come from `@stu/observability`, which is what keeps the envelope schema and this
 * mapping from drifting. Anything unrecognised is reported as no attribute at all rather than as
 * free text, because a raw pathname could carry a student name.
 */
function knownRoute(pathname: string): KnownRouteAttribute {
  const route = httpRoutes.find((candidate) => candidate === pathname);
  return route === undefined ? {} : { "http.route": route };
}

function screenAttribute(pathname: string): ScreenAttribute {
  const segment = pathname.split("/", 2)[1];
  return { "screen.name": screenNames.find((name) => name === segment) ?? "overview" };
}

function browserEnvironment(): BrowserTelemetryEnvironment {
  return {
    origin: window.location.origin,
    fetch: window.fetch.bind(window),
    sendBeacon:
      navigator.sendBeacon === undefined ? undefined : navigator.sendBeacon.bind(navigator),
    now: Date.now,
    random: Math.random,
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
