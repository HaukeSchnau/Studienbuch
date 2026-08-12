# Mobile operational telemetry

This module is the first-party operational telemetry channel. It complements,
and does not replace, EAS Observe's native crash and performance reporting.

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

Native reachability is currently inferred from send results and retried on a
bounded timer and foreground transitions. Web builds additionally respect the
browser online state. Introduce Expo Network only together with a deliberate
dependency/lockfile update and real-device validation.

## Verification

Run `vp test run src/observability/outbox.test.ts` for deterministic restart,
offline, expiry, eviction, retry, and partial-acceptance coverage. Validate the
document-directory behavior on a signed iOS and Android development build; the
Node tests use the storage port and cannot prove platform persistence semantics.
