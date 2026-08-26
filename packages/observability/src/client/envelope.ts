import * as Schema from "effect/Schema";

/**
 * Screens and routes a client may name. Allowlists rather than free strings: that is what
 * guarantees no student identifier or URL can ride along in a telemetry attribute.
 */
export const screenNames = [
  "overview",
  "schedule",
  "tasks",
  "courses",
  "profile",
  "setup",
] as const;
export const httpRoutes = ["/", "/api/auth/*", "/api/observability/v1/telemetry"] as const;

/**
 * Metric names a client may report. The envelope accepts no others, the outbox emits two of them,
 * and the server ingress maps every one onto an instrument. All three read this.
 */
export const clientMetricNames = {
  canaryTotal: "studienbuch_client_canary_total",
  requestDuration: "studienbuch_client_request_duration_ms",
  outboxDepth: "studienbuch_client_outbox_depth",
  outboxDropped: "studienbuch_client_outbox_dropped_total",
} as const;

export type ClientMetricName = (typeof clientMetricNames)[keyof typeof clientMetricNames];

/** Tuple form for `Schema.Literals`, which needs positional literals rather than a union. */
const clientMetricNameList = [
  clientMetricNames.canaryTotal,
  clientMetricNames.requestDuration,
  clientMetricNames.outboxDepth,
  clientMetricNames.outboxDropped,
] as const satisfies ReadonlyArray<ClientMetricName>;

const ShortString = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));
const TraceId = Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/));
const SpanId = Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/));
const NonNegativeFinite = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));
const UnixMillis = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

const ClientAttributes = Schema.Struct({
  "app.operation": Schema.optionalKey(
    Schema.Literals(["navigation", "request", "render", "telemetry.flush"]),
  ),
  "error.type": Schema.optionalKey(Schema.Literals(["network", "timeout", "decode", "unknown"])),
  "http.method": Schema.optionalKey(Schema.Literals(["GET", "POST"])),
  "http.route": Schema.optionalKey(Schema.Literals(httpRoutes)),
  outcome: Schema.optionalKey(Schema.Literals(["success", "failure", "interrupt"])),
  "screen.name": Schema.optionalKey(Schema.Literals(screenNames)),
  "telemetry.priority": Schema.optionalKey(Schema.Literals(["low", "normal", "high"])),
});

const MetricAttributes = Schema.Struct({
  operation: Schema.optionalKey(
    Schema.Literals(["navigation", "request", "render", "telemetry.flush"]),
  ),
  outcome: Schema.optionalKey(Schema.Literals(["success", "failure", "interrupt"])),
  platform: Schema.optionalKey(Schema.Literals(["web", "ios", "android"])),
  signal: Schema.optionalKey(Schema.Literals(["traces", "logs", "metrics", "all"])),
});

export const ClientSpan = Schema.Struct({
  type: Schema.Literal("span"),
  name: Schema.Literals([
    "client.navigation",
    "client.request",
    "client.render",
    "client.telemetry.flush",
  ]),
  traceId: TraceId,
  spanId: SpanId,
  parentSpanId: Schema.optionalKey(SpanId),
  startedAtUnixMillis: UnixMillis,
  durationMillis: NonNegativeFinite,
  status: Schema.Literals(["unset", "ok", "error"]),
  attributes: ClientAttributes,
});
export interface ClientSpan extends Schema.Schema.Type<typeof ClientSpan> {}

export const ClientLog = Schema.Struct({
  type: Schema.Literal("log"),
  event: Schema.Literals([
    "client.request.failed",
    "client.telemetry.canary",
    "client.telemetry.dropped",
  ]),
  severity: Schema.Literals(["debug", "info", "warn", "error"]),
  occurredAtUnixMillis: UnixMillis,
  traceId: Schema.optionalKey(TraceId),
  spanId: Schema.optionalKey(SpanId),
  attributes: ClientAttributes,
});
export interface ClientLog extends Schema.Schema.Type<typeof ClientLog> {}

export const ClientMetric = Schema.Struct({
  type: Schema.Literal("metric"),
  name: Schema.Literals(clientMetricNameList),
  kind: Schema.Literals(["counter", "gauge", "histogram"]),
  value: NonNegativeFinite,
  recordedAtUnixMillis: UnixMillis,
  attributes: MetricAttributes,
});
export interface ClientMetric extends Schema.Schema.Type<typeof ClientMetric> {}

export const ClientTelemetryRecord = Schema.Union([ClientSpan, ClientLog, ClientMetric]);
export type ClientTelemetryRecord = typeof ClientTelemetryRecord.Type;

/** Only clients report through this envelope; the server and console export OTLP directly. */
export const ServiceName = Schema.Literals(["studienbuch-web-client", "studienbuch-mobile"]);
export type ServiceName = typeof ServiceName.Type;

export const ClientTelemetryEnvelope = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  serviceName: ServiceName,
  serviceVersion: ShortString,
  environment: Schema.Literals(["development", "test", "staging", "production"]),
  sentAtUnixMillis: UnixMillis,
  records: Schema.Array(ClientTelemetryRecord).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(100),
  ),
});
export interface ClientTelemetryEnvelope extends Schema.Schema.Type<
  typeof ClientTelemetryEnvelope
> {}

export const decodeClientTelemetryEnvelope = Schema.decodeUnknownEffect(ClientTelemetryEnvelope, {
  errors: "all",
  onExcessProperty: "error",
});

/**
 * What the ingress answers with. Both the server handler and every client transport decode this
 * one definition, so partial acceptance cannot mean two different things on the two sides.
 *
 * `acceptedRecords` may be lower than the number sent; the client retries the remainder rather
 * than dropping it.
 */
export const ClientTelemetryAcknowledgement = Schema.Struct({
  acceptedRecords: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
});
export interface ClientTelemetryAcknowledgement extends Schema.Schema.Type<
  typeof ClientTelemetryAcknowledgement
> {}

export const decodeClientTelemetryAcknowledgement = Schema.decodeUnknownOption(
  ClientTelemetryAcknowledgement,
);
