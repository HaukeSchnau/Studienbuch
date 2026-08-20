export {
  metricAttributes,
  outcomeFromExit,
  spanAttributes,
  type MetricAttributes,
  type ObservabilityOutcome,
  type SpanAttributes,
  type TelemetryPriority,
} from "./attributes.ts";
export { runCanary, type CanaryResult } from "./canary.ts";
export { canaryDuration, canaryTotal } from "./metrics.ts";
export { consoleServiceName, environmentVariables, serverServiceName } from "./project.ts";
export {
  deploymentEnvironments,
  otlpResource,
  resourceAttributes,
  serviceNames,
  serviceNamespace,
  type DeploymentEnvironment,
  type ResourceIdentity,
  type ServiceName,
} from "./resource.ts";
