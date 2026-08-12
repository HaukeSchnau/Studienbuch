# Observability implementation

Updated: 2026-08-12

## Goal

Ship and verify an Effect-native traces, logs, and metrics platform from the Studienbuch runtimes through self-hosted OpenTelemetry Collectors into Tempo, VictoriaLogs, and VictoriaMetrics.

## Scope and invariants

- Keep `packages/core` telemetry-free.
- Keep one production deployable in `apps/web`; TanStack transports remain thin adapters over one process-wide Effect runtime.
- Use pinned Effect v4 OTLP support directly; do not add a second generic OpenTelemetry SDK.
- Public clients never receive collector credentials or arbitrary OTLP proxy access. They send a bounded, versioned, allowlisted Studienbuch envelope to the Studienbuch server.
- The server owns resource identity and accepted attribute vocabulary.
- Production Effect runtime disposal is idempotent and covered by both Nitro lifecycle and Node signal paths.
- OTLP logs replace the default Effect logger in production to avoid duplicate central ingestion through journald. Journald remains an emergency process-output path for non-Effect/runtime failures.
- Mobile crash reporting and EAS native performance signals remain distinct from first-party operational telemetry.
- Do not claim reliable mobile delivery without durable restart/offline tests.

## Work graph

| Packet | Objective                                                           | Ownership                                                                                             | Dependencies                  | Required proof                                                                                     |
| ------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| P1     | Shared telemetry contract and Effect OTLP layer                     | `packages/observability/**`, workspace manifests/lock                                                 | none                          | policy/unit tests; fake OTLP traces/logs/metrics correlation and flush                             |
| P2     | Fleet collector agent/gateway and backend routing                   | `~/infra` observability module/dashboard/tests/docs                                                   | P1 endpoint/resource contract | focused Nix eval/tests, deploy `srv-1` then `srv-2`, backend queries and persistent-queue recovery |
| P3     | Integrated web runtime, request tracing, canary and ingest boundary | `apps/web/src/server.ts`, `src/server-runtime/**`, `src/server-adapters/**`, API routes/plugins/tests | P1                            | built-output runtime singleton, trace continuity, SIGTERM flush, ingress rejection matrix          |
| P4     | Console canary runtime                                              | `apps/console/**`                                                                                     | P1                            | real fake-receiver three-signal test and clean shutdown                                            |
| P5     | Browser telemetry and Sentry privacy hardening                      | web browser observability/bootstrap/Sentry files and guidance                                         | P1, P3 ingress                | no secrets in bundle, same-origin delivery, no normal replay/PII/APM                               |
| P6     | Mobile durable telemetry and crash boundary                         | `apps/mobile/**`                                                                                      | P1, P3 envelope               | deterministic age/size/priority/restart/retry tests, Expo checks, real device cycle                |
| P7     | Studienbuch Nix/release wiring and runbook                          | app Nix/checks/docs/continuity                                                                        | P1, P3–P6 manifests stable    | release build/smoke, graceful shutdown, correct environment/resource identity                      |
| P8     | Integrated production deployment and verification                   | no feature ownership                                                                                  | P2, P7                        | collector-first deploy; trace/log/metric queries; correlation, duplicate and outage checks         |

Only the root integration agent performs Jujutsu operations and production deployment. Worker file ownership must not overlap within an execution wave.

## Current state

- [x] Architecture and retention decisions recorded.
- [x] Repository and fleet synchronized with `main`.
- [x] Parallel analysis of runtime, telemetry, and fleet topology started.
- [x] Pinned Effect/TanStack/Nitro APIs inspected.
- [x] P1 shared foundation.
- [x] P2 collector infrastructure.
- [x] P3 web runtime and ingress.
- [x] P4 console canary.
- [x] P5 browser/Sentry boundary.
- [x] P6 mobile durability/crash boundary (first-party sending remains safely disabled until the app has a short-lived user authority).
- [x] P7 release wiring and documentation.
- [ ] P8 application deployment and final live verification. Collector deployment, synthetic three-signal verification, application packaging, and release smoke are complete.

## Live verification — 2026-08-12

- Deployed the gateway to `srv-1` before the agent on `srv-2`; both host health checks pass.
- Verified loopback application receivers on `127.0.0.1:4318`, loopback collector health/metrics, the Tailnet gateway on `srv-1:14318`, and Tempo moved to `127.0.0.1:14319`.
- Console canary trace `dc6d4bc9934b5a879f1ff2165f4102c4` appeared in Tempo, VictoriaLogs, and VictoriaMetrics with production resource identity and trace/log correlation.
- Gateway outage drill queued one batch for each signal on `srv-2`, then drained all queues to zero after the gateway restarted. Queued trace `ab6dd3ea9c8fe2a2bcf25d77a34976ba`, its logs, and its metric all reached storage.
- Repository `just qa` passes: 5 core tests, 9 observability tests, 4 console tests, 21 web tests, and 21 mobile tests, plus type-aware lint and formatting.
- Reproducible `webApplication`, release package, descriptor, workspace-source, and strengthened all-signal `releaseSmoke` builds pass with the final lockfile hash.
- React Doctor could not establish a changed-lines baseline from this JJ working copy and fell back to a full scan (46/100, dominated by pre-existing mobile/UI and generated-output diagnostics); repository lint, tests, and builds remain the completion authority for this packet.
- Remaining: commit/push Studienbuch, deploy its release, and verify its real health/canary/browser ingress signals. Native mobile document persistence still requires signed-device testing, and first-party mobile sending remains disabled pending a short-lived user authority.

## Known risks and mitigations

- Nitro's production Node preset does not prove SIGTERM invokes the Nitro `close` hook: add explicit signal handling and a built-output child-process test.
- Effect's exporter is in-memory and drops after prolonged failures: applications export to a loopback collector; remote collector exporters use persistent `file_storage` queues.
- Current Sentry settings enable PII, APM, and 100% normal replay: harden before deployment.
- Public OTLP proxying enables spoofing, PII leakage, cardinality attacks, and amplification: decode and rebuild a constrained application envelope.
- The mobile app lacks a production authenticated API transport: keep pre-auth telemetry narrow and do not invent broad authority; use EAS Observe/native crash channels until authenticated first-party delivery is proven.
- Adding a workspace package changes the Nix source closure and fixed pnpm dependency hash: one integration packet owns the authoritative install/hash update.

## Verification matrix

- Package: policy, forbidden keys, bounded labels, config and trace-context tests.
- Runtime: one acquisition across requests; correlated canary; explicit flush; SIGTERM clean exit.
- HTTP: content type/encoding/size/schema/origin/rate/PII/cardinality rejection tests.
- Collector: config validation, health/self-metrics, backend ingestion, queue persistence across restart.
- Build: `just qa`, web/console builds, release smoke, focused Nix checks.
- Production: Tempo trace by ID, one correlated VictoriaLogs record, bounded VictoriaMetrics series, Grafana links/dashboard, outage/recovery, no duplicate logs.
- Clients: browser bundle inspection and real browser request; mobile offline/force-quit/reconnect and symbolication where build credentials permit.

## Open questions

None that block the server, collector, browser, or console foundation. Mobile authentication and signing credentials are external capabilities to verify during P6; if absent, the implemented safe fallback remains EAS Observe plus crash reporting rather than an unauthenticated general telemetry pipe.
