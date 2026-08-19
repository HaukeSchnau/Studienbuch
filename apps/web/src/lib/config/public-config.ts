import type { DeploymentEnvironment } from "@stu/observability/browser";
import { createServerFn } from "@tanstack/react-start";

/**
 * Configuration the browser is allowed to see. Every value here is a public client credential or a
 * build identifier; nothing secret may be added.
 *
 * These are read from the server's environment per request rather than inlined at build time. A
 * `VITE_`-prefixed variable is baked into the bundle by whatever environment ran `vite build`, and
 * the Nix release build has no access to deployment secrets — which is how client Sentry and
 * PostHog previously shipped permanently disabled.
 */
export interface PublicConfig {
  readonly sentryDsn: string | undefined;
  readonly posthogKey: string | undefined;
  readonly posthogHost: string;
  readonly environment: DeploymentEnvironment;
  readonly version: string;
}

const defaultPosthogHost = "https://us.i.posthog.com";

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function deploymentEnvironment(value: string | undefined): DeploymentEnvironment {
  return value === "production" || value === "staging" || value === "test" ? value : "development";
}

export const getPublicConfig = createServerFn({ method: "GET" }).handler((): PublicConfig => ({
  sentryDsn: optionalText(process.env.STUDIENBUCH_SENTRY_DSN),
  posthogKey: optionalText(process.env.STUDIENBUCH_POSTHOG_KEY),
  posthogHost: optionalText(process.env.STUDIENBUCH_POSTHOG_HOST) ?? defaultPosthogHost,
  environment: deploymentEnvironment(process.env.STUDIENBUCH_ENVIRONMENT ?? process.env.NODE_ENV),
  version: optionalText(process.env.STUDIENBUCH_VERSION) ?? "development",
}));
