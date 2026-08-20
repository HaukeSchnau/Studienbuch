import * as Sentry from "@sentry/tanstackstart-react";

let initialized = false;

/**
 * Initializes browser crash reporting. The DSN arrives from the server's runtime configuration, so
 * a release can be pointed at a Sentry project without rebuilding the application.
 */
export function initializeSentryClient(dsn: string) {
  if (initialized || globalThis.window === undefined) {
    return;
  }

  initialized = true;
  Sentry.init({
    dsn,
    integrations: [
      Sentry.replayIntegration({
        blockAllMedia: true,
        maskAllInputs: true,
        maskAllText: true,
      }),
    ],
    replaysOnErrorSampleRate: 1,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}
