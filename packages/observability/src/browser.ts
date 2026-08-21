export { TelemetryPriority } from "./opentelemetry/attributes.ts";
export {
  ClientLog,
  ClientMetric,
  ClientSpan,
  ClientTelemetryAcknowledgement,
  ClientTelemetryEnvelope,
  ClientTelemetryRecord,
  ServiceName,
  clientMetricNames,
  httpRoutes,
  screenNames,
  type ClientMetricName,
  decodeClientTelemetryAcknowledgement,
  decodeClientTelemetryEnvelope,
} from "./client/envelope.ts";
export {
  OUTBOX_MAX_AGE_MS,
  OUTBOX_MAX_BYTES,
  TelemetryOutbox,
  memoryTelemetryStorage,
  type FlushResult,
  type OutboxStats,
  type TelemetryClock,
  type TelemetryDelivery,
  type TelemetryOutboxOptions,
  type TelemetryPlatform,
  type TelemetryRandom,
  type TelemetryStorage,
} from "./client/outbox.ts";
export {
  externalSpanFromHeaders,
  propagationHeaders,
  withIncomingTraceContext,
} from "./opentelemetry/trace-context.ts";
export type { DeploymentEnvironment } from "./opentelemetry/resource.ts";
