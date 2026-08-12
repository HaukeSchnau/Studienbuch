export {
  ClientLog,
  ClientMetric,
  ClientSpan,
  ClientTelemetryEnvelope,
  ClientTelemetryRecord,
  decodeClientTelemetryEnvelope,
  type ClientTelemetryEnvelope as ClientTelemetryEnvelopeType,
  type ClientTelemetryRecord as ClientTelemetryRecordType,
} from "./client-envelope.ts";
export {
  externalSpanFromHeaders,
  propagationHeaders,
  withIncomingTraceContext,
} from "./trace-context.ts";
export type { DeploymentEnvironment } from "./resource.ts";
