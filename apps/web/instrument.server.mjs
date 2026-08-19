import * as Sentry from "@sentry/tanstackstart-react";

const sentryDsn = process.env.STUDIENBUCH_SENTRY_DSN;

if (!sentryDsn) {
  console.warn("STUDIENBUCH_SENTRY_DSN is not defined. Server-side Sentry is not running.");
} else {
  Sentry.init({
    dsn: sentryDsn,
    // Effect and OTLP own performance telemetry. Sentry remains the narrowly
    // scoped crash/error system and must not collect request PII by default.
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}
