export const serviceNamespace = "studienbuch" as const;

export const serviceNames = [
  "studienbuch-server",
  "studienbuch-console",
  "studienbuch-migration",
  "studienbuch-worker",
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

interface ResourceAttributes extends Record<string, string> {
  "service.namespace": typeof serviceNamespace;
  "deployment.environment.name": DeploymentEnvironment;
}

export function resourceAttributes(identity: ResourceIdentity): Readonly<ResourceAttributes> {
  const attributes: ResourceAttributes = {
    "service.namespace": serviceNamespace,
    "deployment.environment.name": identity.environment,
  };

  if (identity.instanceId !== undefined) {
    attributes["service.instance.id"] = identity.instanceId;
  }

  return attributes;
}

export function otlpResource(identity: ResourceIdentity) {
  return {
    serviceName: identity.serviceName,
    serviceVersion: identity.serviceVersion,
    attributes: resourceAttributes(identity),
  };
}
