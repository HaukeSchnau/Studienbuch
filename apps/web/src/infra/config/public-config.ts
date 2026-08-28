import type { DeploymentEnvironment } from "@stu/observability/browser";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Configuration the browser is allowed to see. Every value here is a public client credential or a
 * build identifier; nothing secret may be added.
 *
 * These are read from the server's environment per request rather than inlined at build time. A
 * `VITE_`-prefixed variable is baked into the bundle by whatever environment ran `vite build`, and
 * the Nix release build has no access to deployment secrets — which is how client Sentry previously
 * shipped permanently disabled.
 */
export interface PublicConfig {
  readonly sentryDsn: string | undefined;
  readonly environment: DeploymentEnvironment;
  readonly instanceId: string | undefined;
  readonly version: string;
}

export interface PublicShellState {
  readonly config: PublicConfig;
  /** Whether the SSR shell must initialize Vite's experimental bundled development runtime. */
  readonly bundledDev: boolean;
  /**
   * A rendering hint, not proof of authentication. Reading the token cookie avoids showing the
   * signed-out call to action while the browser verifies an existing session.
   */
  readonly hasSessionCookie: boolean;
}

function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function deploymentEnvironment(value: string | undefined): DeploymentEnvironment {
  return value === "production" || value === "staging" || value === "test" ? value : "development";
}

export const getPublicShellState = createServerFn({ method: "GET" }).handler(
  (): PublicShellState => ({
    bundledDev: process.env.STUDIENBUCH_WEB_BUNDLED_DEV === "1",
    config: {
      sentryDsn: optionalText(process.env.STUDIENBUCH_SENTRY_DSN),
      environment: deploymentEnvironment(
        process.env.STUDIENBUCH_ENVIRONMENT ?? process.env.NODE_ENV,
      ),
      instanceId: optionalText(process.env.STUDIENBUCH_INSTANCE_ID),
      version: optionalText(process.env.STUDIENBUCH_VERSION) ?? "development",
    },
    hasSessionCookie: getSessionCookie(getRequest()) !== null,
  }),
);
