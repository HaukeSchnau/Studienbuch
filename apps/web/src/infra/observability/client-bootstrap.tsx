import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import type { PublicConfig } from "#/infra/config/public-config.ts";

/**
 * Starts client observability once the runtime configuration has arrived.
 *
 * Rendered for its effects only. Both Sentry and the operational telemetry client are imported
 * dynamically so a page that never errors does not pay for them on first paint, and so the router
 * factory stays free of telemetry policy.
 */
export function ClientObservability({ config }: { readonly config: PublicConfig }) {
  const router = useRouter();

  useEffect(() => {
    const dsn = config.sentryDsn;
    if (dsn === undefined) return;
    void import("./sentry-client.ts").then(({ initializeSentryClient }) => {
      initializeSentryClient(dsn);
    });
  }, [config.sentryDsn]);

  useEffect(() => {
    const initializedAt = performance.now();
    let dispose: (() => void) | undefined;
    let disposed = false;

    void import("./browser-client.ts").then(
      ({ browserTelemetry, installBrowserTelemetryLifecycle }) => {
        if (disposed) return;
        const telemetry = browserTelemetry({
          serviceVersion: config.version,
          deploymentEnvironment: config.environment,
        });
        if (telemetry === undefined) return;

        let navigationStartedAt: number | undefined;
        let recordedInitialRender = false;
        telemetry.recordCanary();
        const removeLifecycle = installBrowserTelemetryLifecycle(telemetry);
        const unsubscribers = [
          router.subscribe("onBeforeNavigate", ({ pathChanged }) => {
            if (pathChanged) navigationStartedAt = performance.now();
          }),
          router.subscribe("onResolved", ({ pathChanged, toLocation }) => {
            if (pathChanged && navigationStartedAt !== undefined) {
              telemetry.recordNavigation(
                performance.now() - navigationStartedAt,
                toLocation.pathname,
              );
              navigationStartedAt = undefined;
            }
          }),
          router.subscribe("onRendered", ({ toLocation }) => {
            if (recordedInitialRender) return;
            recordedInitialRender = true;
            telemetry.recordRender(performance.now() - initializedAt, toLocation.pathname);
          }),
        ];
        dispose = () => {
          for (const unsubscribe of unsubscribers) unsubscribe();
          removeLifecycle();
        };
      },
    );

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [config.environment, config.version, router]);

  return null;
}
