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
  TelemetryDelivery,
  TelemetryOutbox,
  TelemetryStorage,
  TelemetryStorageError,
  makeTelemetryOutbox,
  memoryTelemetryStorage,
  telemetryOutboxLayer,
  type FlushResult,
  type OutboxStats,
  type TelemetryDeliveryResult,
  type TelemetryOutboxOptions,
  type TelemetryPlatform,
} from "./client/outbox.ts";
export {
  makeTelemetryHttpDelivery,
  type TelemetryHttpDeliveryOptions,
} from "./client/http-delivery.ts";
export {
  externalSpanFromHeaders,
  propagationHeaders,
  withIncomingTraceContext,
} from "./opentelemetry/trace-context.ts";
export type { DeploymentEnvironment } from "./opentelemetry/resource.ts";
