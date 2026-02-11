# Effect + Local-First Migration Plan (Execution Plan)

Status: Active plan  
Last updated: 2026-02-11  
Architecture decisions: `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/docs/adr/0001-standalone-api-mobile-priority.md`

## 1. Goal

Bring the system to a stable, production-ready state with:

- reliable offline-first mobile behavior,
- deterministic cross-device sync,
- working Untis background imports,
- and a clear Effect-first backend architecture on the standalone API.

## 2. Scope And Priorities

### In scope (P0)

- Mobile app correctness and user flows.
- Sync pipeline correctness (ingest, topic routing, broadcast, replay, offset).
- Server-side event applicator parity (including `absence.*` and `grades.*`).
- Untis import/cron reliability and data quality.
- CI/typecheck/test gates needed to keep migration stable.

### In scope (P1)

- Reduce legacy tRPC surfaces where they block P0.
- Stabilize temporary Next.js admin usage without large redesign.

### Out of scope (for now)

- Next.js admin rewrite (long-term TanStack Start/Router).
- broader platform redesign unrelated to mobile sync and import jobs.

## 3. Current Baseline (Problem Statement)

- Sync broadcast path is not complete in current implementation.
- Some server applicator coverage is missing for mobile-emitted event namespaces.
- Snapshot strategy is documented but not implemented end-to-end.
- Mobile setup still depends partly on tRPC/bootstrap writes instead of pure event/snapshot flow.
- CI guardrails are incomplete (`ci` script/task mismatch, missing Next.js typecheck coverage).
- Existing tests do not yet provide strong confidence for sync invariants.

## 4. Target Stable State (Definition Of Done)

The migration is considered stable when all criteria are true:

1. Mobile can run offline, queue events, and converge after reconnect.
2. Cross-device sync works for all user actions, including absence and grades.
3. Replay from offset is reliable and duplicate-safe.
4. Every mobile-emitted event type has server verification/apply/topic behavior.
5. Snapshot bootstrapping handles unknown referenced entities and transitive dependencies.
6. Untis jobs are idempotent and observable, and imported data remains consistent.
7. CI catches type, lint, and behavior regressions before merge.

## 5. Workstreams

## WS-A: Sync Transport And Broadcast Reliability (P0)

### Objective

Make the standalone API sync path operational and deterministic.

### Tasks

- Implement and enable `publishToUser` behavior in API broadcast service.
- Ensure missing events are marked and streamed correctly.
- Ensure live events are delivered in subscription streams after initial replay.
- Decide runtime mode explicitly:
  - memory mode for local/dev only,
  - RabbitMQ mode for environments requiring durable fanout.
- Complete offset lifecycle:
  - client sends offset on connect,
  - server replays from offset,
  - client persists latest consumed offset.

### Acceptance tests

- Client A emits event while offline, reconnects, server ingests once.
- Client B (same user) receives event after reconnect.
- Reconnect with prior offset does not duplicate processed events.

## WS-B: Server Applicator Parity (P0)

### Objective

Eliminate silent no-op behavior by providing complete server support for all client event namespaces.

### Tasks

- Add server applicators for:
  - `absence.*`
  - `grades.*`
- Register these namespaces in server applicator tree.
- Add explicit topic mapping for sensitive events via user-private topics:
  - `students.user.<studentId>`
- Enforce authorization rules for student-private actions.
- Fix known verify/apply logic bugs and contradictory validations.

### Acceptance tests

- Every event emitted by mobile `useIngest(...)` is accepted/rejected deterministically server-side.
- Invalid events fail with typed error (not `die`/defect).
- No namespace logs "no applicator found" during normal flows.

## WS-C: Snapshot And Bootstrap Strategy (P0)

### Objective

Implement the documented snapshot model so unknown entity references are resolvable without manual bootstrap hacks.

### Tasks

- Define snapshot contracts by aggregate/entity:
  - student profile + memberships
  - course + teachers + timetable dependencies
  - absence and grade state projections
- Add API endpoints/handlers for snapshot pull during sync/bootstrap.
- Ensure transitive dependency snapshots are fetched or batched.
- Integrate snapshot resolution into client sync flow.
- Remove ad hoc setup-time local writes once snapshot path is reliable.

### Acceptance tests

- Fresh install can bootstrap from minimal auth/session state and converge to full read model.
- Referenced-but-missing entity during replay triggers snapshot fetch and continues replay successfully.

## WS-D: Mobile App Stabilization (P0)

### Objective

Ship a robust mobile experience on top of the sync architecture.

### Tasks

- Remove placeholder/error-swallowing behavior in setup flows.
- Convert setup flow failures to user-visible actionable states.
- Reduce transitional tRPC dependencies in mobile setup where snapshots/events can replace them.
- Validate background sync behavior across app lifecycle transitions.

### Acceptance tests

- Setup flows complete without hidden fallback data.
- App remains usable across offline/online transitions.
- Sync status and failures are observable in app diagnostics/dev tools.

## WS-E: Untis Background Jobs (P0)

### Objective

Ensure school structure and timetable imports are reliable, idempotent, and operationally observable.

### Tasks

- Confirm ingestion commands are idempotent at event and projection levels.
- Add structured logs and metrics for:
  - job start/end,
  - counts (created/updated/skipped/errors),
  - source window (semester/date range),
  - per-school run status.
- Add failure policy:
  - retry with bounded backoff,
  - dead-letter/reporting for repeated failures.
- Validate scheduler/cron behavior and environment wiring.

### Acceptance tests

- Re-running import for same window does not create duplicates.
- Partial job failure is visible and actionable.
- Imported data remains consistent across repeated runs.

## WS-F: Quality Gates And CI (P0)

### Objective

Prevent regression while migration is underway.

### Tasks

- Fix root CI scripts so they execute real tasks (`ci`, `format`, `typecheck`, `test`).
- Add/repair package-level typecheck coverage (including currently excluded/placeholder packages).
- Add integration tests for:
  - ingest + apply + broadcast + replay,
  - offset persistence,
  - cross-device absence/grades sync.
- Remove or fix empty/broken test suites and unstable external dependency assumptions.

### Acceptance tests

- `bun run ci` executes and passes on a clean environment.
- Sync integration tests run in CI and fail fast on regressions.

## 6. Milestones And Sequence

## Milestone M1: Sync Core Correctness

- WS-A complete (baseline broadcast/replay/offset path operational).
- WS-B started with absence/grades applicators merged.

## Milestone M2: Sensitive Event Parity

- WS-B complete (absence/grades cross-device validated).
- Initial WS-C snapshot endpoints merged.

## Milestone M3: Mobile Bootstrap Stabilized

- WS-C and WS-D complete for setup/bootstrap flow.
- Mobile can onboard and converge without manual bootstrap writes.

## Milestone M4: Untis Reliability

- WS-E complete with instrumentation and idempotency checks.

## Milestone M5: Hardening Gate

- WS-F complete and enforced in CI.
- go/no-go checklist for stable release signed off.

## 7. Implementation Backlog (Ordered)

1. Enable broadcast publish and replay correctness in standalone API.
2. Add server applicators for all mobile `absence.*` and `grades.*` events.
3. Introduce user-private topic routing for sensitive events.
4. Persist sync offset on client and verify replay behavior.
5. Implement snapshot APIs and client snapshot resolver.
6. Remove setup bootstrap hacks replaced by snapshot/event flow.
7. Harden Untis job observability + idempotency.
8. Repair CI scripts and test matrix.
9. De-scope non-critical admin migrations until P0 is stable.

## 8. Risk Register

- Risk: hidden legacy paths bypass Effect guarantees.
  - Mitigation: inventory and progressively gate direct DB/tRPC paths.
- Risk: sensitive data leaks through broad topic subscriptions.
  - Mitigation: private topic policy for absence/grades + authorization tests.
- Risk: flaky external dependencies (Untis) destabilize CI.
  - Mitigation: isolate integration tests and use deterministic fixtures for CI.
- Risk: migration stalls due to weak feedback loops.
  - Mitigation: enforce CI gates and runtime telemetry before each milestone.

## 9. Verification Checklist (Per Release Candidate)

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- sync integration suite passes (ingest/replay/offset/cross-device)
- one full Untis import dry-run in staging-like environment
- manual mobile scenario:
  - offline create/update
  - reconnect and sync
  - second device receives absence/grades changes

## 10. Ownership Model

- API/sync engine: backend team
- mobile runtime/setup: mobile team
- Untis ingestion jobs: data/backend team
- CI/test infrastructure: platform/shared team

Each workstream must have one directly accountable owner and explicit handoff notes at milestone boundaries.
