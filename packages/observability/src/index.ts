export {
  metricAttributes,
  outcomeFromExit,
  spanAttributes,
  type MetricAttributes,
  type ObservabilityOutcome,
  type SpanAttributes,
  type TelemetryPriority,
} from "./opentelemetry/attributes.ts";
export { metricNames, observabilityContract } from "./contract.ts";
export {
  logErrorEvent,
  logInfoEvent,
  logWarningEvent,
  type LogEventAttributes,
} from "./opentelemetry/log-events.ts";
export { runCanary, type CanaryResult } from "./otlp/canary.ts";
export { canaryDuration, canaryTotal } from "./otlp/metrics.ts";
export {
  authRequests,
  serverHttpRequestDuration,
  serverHttpRequests,
  smtpDeliveries,
  smtpDeliveryDuration,
  workerJobDuration,
  workerJobs,
  workerLastSuccess,
} from "./otlp/application-metrics.ts";
export {
  deploymentEnvironments,
  otlpResource,
  resourceAttributes,
  serviceNames,
  serviceNamespace,
  type DeploymentEnvironment,
  type ResourceIdentity,
  type ServiceName,
} from "./opentelemetry/resource.ts";
