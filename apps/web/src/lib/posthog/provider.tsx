import { PostHogProvider as BasePostHogProvider } from "@posthog/react";
import type { ReactNode } from "react";
import type { PublicConfig } from "#/lib/config/public-config.ts";

/**
 * Product analytics, configured from the server at runtime.
 *
 * When no key is configured the provider is skipped entirely, so development and test runs never
 * construct a PostHog client. Consumers must therefore treat `usePostHog` as optional rather than
 * assume a client is always present.
 */
export default function PostHogProvider({
  config,
  children,
}: {
  readonly config: PublicConfig;
  readonly children: ReactNode;
}) {
  if (config.posthogKey === undefined) return children;

  return (
    <BasePostHogProvider
      apiKey={config.posthogKey}
      options={{
        api_host: config.posthogHost,
        person_profiles: "identified_only",
        capture_pageview: false,
        defaults: "2025-11-30",
      }}
    >
      {children}
    </BasePostHogProvider>
  );
}
