import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  if (typeof window !== "undefined") {
    void import("#/lib/observability/sentry-client.ts").then(({ initializeSentryClient }) => {
      initializeSentryClient();
    });
  }

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined") {
    const initializedAt = performance.now();
    void import("#/lib/observability/browser-client.ts").then(
      ({ browserTelemetry, installBrowserTelemetryLifecycle }) => {
        const telemetry = browserTelemetry();
        let navigationStartedAt: number | undefined;
        let recordedInitialRender = false;
        telemetry.recordCanary();
        installBrowserTelemetryLifecycle(telemetry);
        router.subscribe("onBeforeNavigate", ({ pathChanged }) => {
          if (pathChanged) navigationStartedAt = performance.now();
        });
        router.subscribe("onResolved", ({ pathChanged, toLocation }) => {
          if (pathChanged && navigationStartedAt !== undefined) {
            telemetry.recordNavigation(
              performance.now() - navigationStartedAt,
              toLocation.pathname,
            );
            navigationStartedAt = undefined;
          }
        });
        router.subscribe("onRendered", ({ toLocation }) => {
          if (!recordedInitialRender) {
            recordedInitialRender = true;
            telemetry.recordRender(performance.now() - initializedAt, toLocation.pathname);
          }
        });
      },
    );
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
