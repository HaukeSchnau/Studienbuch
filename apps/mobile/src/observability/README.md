# Mobile operational telemetry

This module is the first-party operational telemetry channel. It complements EAS Observe and
Sentry: Sentry owns deployed crash/error reporting, while this channel owns allowlisted operational
records. Effect/OpenTelemetry remains the server instrumentation system.

Only the allowlisted records from `@stu/observability/browser` can enter the
queue. They intentionally contain no student identifiers, content, free text,
URLs, or arbitrary attributes. The durable Expo document-storage outbox is
limited to 10 MiB and seven days. Capacity eviction removes the oldest
low-priority records first, then normal and high priority. Sends are capped at
100 records, retain partially accepted records, and use bounded exponential
backoff.

## Activation

`EXPO_PUBLIC_TELEMETRY_ENDPOINT` is optional. Missing configuration disables
the channel. An endpoint alone is insufficient: `MobileTelemetryProvider` also
requires an `authorization` function returning a short-lived, user-scoped
Authorization header. The current application has no mobile session authority,
so its provider is deliberately disabled. Do not replace this with a static
public token or an unauthenticated ingestion route.

Once mobile authentication exists, pass that authority from the session owner
to `MobileTelemetryProvider`. The endpoint must be the Studienbuch server relay,
never the fleet collector directly.

`expo-network` is installed for Better Auth's Expo client and is the preferred native reachability
source when the telemetry provider is connected to authenticated sessions. Until then, send results,
bounded retries, and foreground transitions remain the telemetry channel's only signals.

## Sentry

`EXPO_PUBLIC_SENTRY_DSN` enables Sentry. The SDK sends no default PII, screenshots, replay, or
performance traces. Native build source maps use `SENTRY_ORG`, `SENTRY_PROJECT`, and the secret
`SENTRY_AUTH_TOKEN`; never place the auth token in Expo public variables or app config.

## Verification

Run `vp test run src/observability/outbox.test.ts` for deterministic restart,
offline, expiry, eviction, retry, and partial-acceptance coverage. Validate the
document-directory behavior on a signed iOS and Android development build; the
Node tests use the storage port and cannot prove platform persistence semantics.
