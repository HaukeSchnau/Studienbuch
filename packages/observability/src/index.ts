export {
  metricAttributes,
  outcomeFromExit,
  spanAttributes,
  type MetricAttributes,
  type ObservabilityOutcome,
  type SpanAttributes,
  type TelemetryPriority,
} from "./shared/attributes.ts";
export { runCanary, type CanaryResult } from "./otlp/canary.ts";
export { canaryDuration, canaryTotal } from "./otlp/metrics.ts";
export {
  deploymentEnvironments,
  otlpResource,
  resourceAttributes,
  serviceNames,
  serviceNamespace,
  type DeploymentEnvironment,
  type ResourceIdentity,
  type ServiceName,
} from "./shared/resource.ts";
