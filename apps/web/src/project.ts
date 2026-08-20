import { environmentVariables as sharedEnvironmentVariables } from "@stu/observability";

/**
 * Everything in this application that is specific to Studienbuch.
 *
 * Names the app emits or reads: environment variables, telemetry attribution, the mobile scheme.
 * Product vocabulary shared with other clients (screens, routes, client metric names) lives in
 * `@stu/observability`'s own project module instead, so every consumer sees one definition.
 */

/**
 * Environment variables this application reads, on top of the deployment identity every runtime
 * shares.
 */
export const environmentVariables = {
  ...sharedEnvironmentVariables,
  sentryDsn: "STUDIENBUCH_SENTRY_DSN",
  hostNames: "STUDIENBUCH_WEB_HOST_NAMES",
} as const;

export const documentTitle = "Studienbuch" as const;

/** Service identities are defined once, in the package every client and server shares. */
export { serverServiceName } from "@stu/observability";
export { webClientServiceName } from "@stu/observability/browser";

/** Marks records that arrived from a public client rather than from server instrumentation. */
export const ingressSource = "public-client-ingress" as const;

export const ingestedRecordsMetricName = "studienbuch_client_telemetry_records_total" as const;

/** Custom scheme the mobile client uses for OAuth and deep links. */
export const mobileTrustedOrigins = ["studienbuch://", "studienbuch://*"] as const;
