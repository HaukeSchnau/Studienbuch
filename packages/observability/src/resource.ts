export const serviceNamespace = "studienbuch" as const;

export const serviceNames = [
  "studienbuch-server",
  "studienbuch-console",
  "studienbuch-web-client",
  "studienbuch-mobile",
] as const;

export type ServiceName = (typeof serviceNames)[number];

export const deploymentEnvironments = ["development", "test", "staging", "production"] as const;

export type DeploymentEnvironment = (typeof deploymentEnvironments)[number];

export interface ResourceIdentity {
  readonly serviceName: ServiceName;
  readonly serviceVersion: string;
  readonly environment: DeploymentEnvironment;
  readonly instanceId?: string;
}

export function resourceAttributes(identity: ResourceIdentity): Readonly<Record<string, string>> {
  return {
    "service.namespace": serviceNamespace,
    "deployment.environment.name": identity.environment,
    ...(identity.instanceId === undefined ? {} : { "service.instance.id": identity.instanceId }),
  };
}

export function otlpResource(identity: ResourceIdentity) {
  return {
    serviceName: identity.serviceName,
    serviceVersion: identity.serviceVersion,
    attributes: resourceAttributes(identity),
  };
}
