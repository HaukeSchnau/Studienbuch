import * as Sentry from "@sentry/tanstackstart-react";

let initialized = false;

export function initializeSentryClient() {
  if (initialized || typeof window === "undefined") {
    return;
  }

  initialized = true;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    return;
  }

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
