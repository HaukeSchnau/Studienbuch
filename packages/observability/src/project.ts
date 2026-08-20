/**
 * Everything in this package that is specific to Studienbuch.
 *
 * The rest of `@stu/observability` is deliberately project-free: a queue, an envelope shape, OTLP
 * layers, trace-context helpers. Copying it into another project means rewriting this one file and
 * nothing else, which is why `boundaries/no-project-name` refuses the literal "studienbuch"
 * anywhere but here.
 *
 * Listing every environment variable the package reads in one place is a second benefit. The
 * previous scatter is how `.env.example` came to document variables nothing read, and miss ones
 * that were.
 */

export const serviceNamespace = "studienbuch" as const;

export const serverServiceName = "studienbuch-server" as const;
export const consoleServiceName = "studienbuch-console" as const;
export const webClientServiceName = "studienbuch-web-client" as const;
export const mobileServiceName = "studienbuch-mobile" as const;

/** Services that report through the client telemetry envelope rather than exporting OTLP directly. */
export const clientServiceNames = [webClientServiceName, mobileServiceName] as const;

export const serviceNames = [serverServiceName, consoleServiceName, ...clientServiceNames] as const;

/**
 * Environment variables read anywhere observability reaches, which is every runtime. Deployment
 * identity (`environment`, `version`) lives here rather than per app so the web server, the console
 * and the browser cannot disagree about what a release is called.
 */
export const environmentVariables = {
  environment: "STUDIENBUCH_ENVIRONMENT",
  version: "STUDIENBUCH_VERSION",
  otelEnabled: "STUDIENBUCH_OTEL_ENABLED",
  otelEndpoint: "OTEL_EXPORTER_OTLP_ENDPOINT",
  logLevel: "STUDIENBUCH_LOG_LEVEL",
  traceLevel: "STUDIENBUCH_TRACE_LEVEL",
  exportInterval: "STUDIENBUCH_OTEL_EXPORT_INTERVAL",
  shutdownTimeout: "STUDIENBUCH_OTEL_SHUTDOWN_TIMEOUT",
} as const;

/** Metric names emitted by the server canary. */
export const canaryMetricNames = {
  total: "studienbuch_observability_canary_total",
  duration: "studienbuch_observability_canary_duration",
} as const;

/**
 * Metric names a client may report. The envelope accepts no others, the outbox emits two of them,
 * and the server ingress maps every one onto a server-side instrument. All three read this.
 */
export const clientMetricNames = {
  canaryTotal: "studienbuch_client_canary_total",
  requestDuration: "studienbuch_client_request_duration_ms",
  outboxDepth: "studienbuch_client_outbox_depth",
  outboxDropped: "studienbuch_client_outbox_dropped_total",
} as const;

export type ClientMetricName = (typeof clientMetricNames)[keyof typeof clientMetricNames];

/** Tuple form for `Schema.Literals`, which needs positional literals rather than a union. */
export const clientMetricNameList = [
  clientMetricNames.canaryTotal,
  clientMetricNames.requestDuration,
  clientMetricNames.outboxDepth,
  clientMetricNames.outboxDropped,
] as const satisfies ReadonlyArray<ClientMetricName>;

/**
 * Screens a client may name in telemetry.
 *
 * This is product vocabulary, and it used to sit inside the envelope schema, which meant adding a
 * screen to the app required editing the observability package. It stays an allowlist rather than
 * a free string because that is what guarantees no student identifier or URL can ride along.
 */
export const screenNames = [
  "overview",
  "schedule",
  "tasks",
  "courses",
  "profile",
  "setup",
] as const;

/** Routes a client may name in telemetry. Same allowlist reasoning as `screenNames`. */
export const httpRoutes = ["/", "/api/observability/v1/telemetry"] as const;
