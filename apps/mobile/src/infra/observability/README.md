# Mobile operational telemetry

This module is the first-party operational telemetry channel. It complements EAS Observe and
Sentry: Sentry owns deployed crash/error reporting, while this channel owns allowlisted operational
records. Effect/OpenTelemetry remains the server instrumentation system.

The queue itself is the `TelemetryOutbox` Effect service from `@stu/observability/browser`, shared
with the web client. This module supplies the native layers: durable Expo document storage,
authenticated delivery, Expo Network reachability, and React Native app lifecycle. The controller
is one cancellable Effect program rather than a second timer/subscription state machine. See that
package's README for the channel contract and queue guarantees.

## Activation

`EXPO_PUBLIC_TELEMETRY_ENDPOINT` is optional. Missing configuration disables
the channel. An endpoint alone is insufficient: `MobileTelemetryProvider` also
requires an `authorization` function returning a short-lived, user-scoped
Authorization header. The current application has no mobile session authority,
so its provider is deliberately disabled. Do not replace this with a static
public token or an unauthenticated ingestion route.

The server side is ready: the ingress admits native clients on a resolvable Better Auth session,
having previously refused them for lacking an `Origin` header. What is still missing is only the
app's own session, so once mobile authentication exists, pass that authority from the session owner
to `MobileTelemetryProvider`. The endpoint must be the Studienbuch server relay, never the fleet
collector directly.

Once enabled, the controller flushes after foregrounding, restored Expo Network reachability, and a
30-second fallback cadence. Failed sends remain durable and use the shared per-record backoff.

## Sentry

`EXPO_PUBLIC_SENTRY_DSN` enables Sentry. The SDK sends no default PII, screenshots, replay, or
performance traces. Native build source maps use `SENTRY_ORG`, `SENTRY_PROJECT`, and the secret
`SENTRY_AUTH_TOKEN`; never place the auth token in Expo public variables or app config.

## Verification

Queue behavior -- restart, offline, expiry, eviction, retry, partial acceptance -- is covered once
in `@stu/observability`. Validate the document-directory behavior on a signed iOS and Android
development build; the Node tests use the storage port and cannot prove platform persistence
semantics.
