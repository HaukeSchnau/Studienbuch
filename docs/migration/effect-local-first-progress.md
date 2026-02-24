# Effect + Local-First Migration Progress

Status: Active  
Last updated: 2026-02-17

## Scope Lock

- backend runtime: standalone API only (`@stu/api`)
- top priority: mobile offline-first sync correctness
- required parity: cross-device sync for absences and grades
- parallel priority: Untis school structure and timetable background jobs
- non-priority for now: Next.js admin rewrite (future TanStack Start/Router)

## Completed In This Iteration

- Added ingest-to-broadcast integration tests in:
  - `packages/api/src/sync.integration.test.ts`
- Added Expo lifecycle sync coverage and runtime refresh behavior in:
  - `packages/app-mobile/src/utils/sync-lifecycle.ts`
  - `packages/app-mobile/src/utils/sync-lifecycle.test.ts`
  - `packages/app-mobile/src/app/_layout.tsx`
- Added Maestro E2E harness and lifecycle flows in:
  - `packages/app-mobile/src/app/e2e/sync-lifecycle.tsx`
  - `packages/app-mobile/maestro/flows/sync-lifecycle-resume.yml`
  - `packages/app-mobile/maestro/flows/sync-lifecycle-replay.yml`
  - `packages/app-mobile/maestro/flows/sync-lifecycle-network-reconnect.yml`
  - `packages/app-mobile/maestro/flows/sync-lifecycle-sensitive-auth-reconnect.yml`
  - `packages/app-mobile/maestro/flows/shared/open-sync-lifecycle.yml` (iOS prompt/Expo launcher resilient open path)
  - `packages/app-mobile/maestro/flows/shared/attempt-control-center-connectivity-toggle.yml`
  - `packages/app-mobile/maestro/README.md`
  - `flake.nix` (adds direct `maestro` in dev shell)
- Executed Maestro lifecycle suite on iOS Simulator (`iPhone 17 Pro`, iOS 26.2) with passing resume/replay/network-reconnect/sensitive-auth-reconnect flows.
- New integration coverage now verifies:
  - one ingested event reaches multiple live subscribers for the same user (cross-device),
  - reconnect replay from `offset` returns only missing events (no duplicate re-delivery),
  - user-stream isolation (no leakage to other users),
  - client sync-runtime reconnect behavior with persisted offset state,
  - client convergence for `absence.recorded` and `grades.currentGradeSet` across two live runtimes,
  - runtime refresh decisions on lifecycle transitions:
    - background/inactive -> active,
    - offline -> online,
  - replay of missed events after simulated device offline/background -> reconnect lifecycle transition,
  - sensitive grades cross-device convergence for:
    - `grades.teacherApproved`,
    - `grades.parentApproved`,
    - `grades.latestRestored`,
  - sensitive grades replay convergence after one-device-offline transitions for:
    - `grades.teacherApproved`,
    - `grades.parentApproved`,
    - `grades.latestRestored`.
  - unauthorized sensitive-grade events are rejected and not replayed after one-device-offline reconnect for:
    - `grades.teacherApproved`,
    - `grades.parentApproved`,
    - `grades.latestRestored`.
  - lifecycle-level reconnect behavior for sensitive grades now verifies both:
    - runtime auth rejection counters,
    - replay convergence that applies only authorized queued sensitive events after reconnect.
- Existing broadcast and offset persistence implementation remains active:
  - `packages/api/src/broadcast.ts`
  - `packages/app-mobile/src/utils/groundswell.tsx`
- Added WS-C slice 1 shared snapshot contracts in:
  - `packages/lib/src/snapshot.ts`
- Added WS-C slice 1 snapshot API resolver + endpoint in:
  - `packages/api/src/snapshot-resolver.ts`
  - `packages/api/src/snapshot.ts`
  - `packages/api/src/base.ts`
- Added mobile apply-time unknown-entity snapshot recovery in:
  - `packages/app-mobile/src/utils/snapshot-recovery.ts`
  - `packages/app-mobile/src/utils/groundswell.tsx`
- Added WS-C slice 1 unit coverage in:
  - `packages/api/src/snapshot.test.ts`
  - `packages/app-mobile/src/utils/snapshot-recovery.test.ts`
- Extended WS-C snapshot contracts + resolver for absence/grade projections in:
  - `packages/lib/src/snapshot.ts`
  - `packages/api/src/snapshot-resolver.ts`
  - `packages/api/src/snapshot.ts`
- Removed remaining setup-time local DB bootstrap writes and switched setup to snapshot/event bootstrap in:
  - `packages/app-mobile/src/app/setup/name-and-year.tsx`
  - `packages/app-mobile/src/app/setup/class-and-courses.tsx`
- Added setup-related runtime hardening:
  - local verify bypass for setup dependency misses (`student.joined`, `student.courseAssigned`) with server-side verification still authoritative,
  - setup snapshot hydration + convergence wait before navigation.

## Current Workstream Status

- WS-A Sync transport and broadcast reliability: in progress (core implementation + server and client-runtime integration coverage done)
- WS-B Server applicator parity: in progress (`absence.*` + `grades.*` server coverage done; sensitive grades convergence + unauthorized replay guards covered)
- WS-C Snapshot and bootstrap strategy: in progress (slice 2 complete: absence/grade projections + setup bootstrap writes removed)
- WS-D Mobile app stabilization: in progress (lifecycle controller + unit tests + Maestro device-harness flows added)
- WS-E Untis background jobs: not started in code
- WS-F Quality gates and CI: in progress

## Checks

- `bun run lint`: PASS
- `bun run typecheck`: PASS
- `bun run test`: PASS
- `bun run ci`: PASS (root `ci` uses lint + typecheck)
- `bun run test:maestro:mobile`: PASS (with booted iOS Simulator + running `dev:e2e` Metro)

All targeted checks for this slice pass in this iteration.

## Known Risks / Gaps

- Maestro lifecycle E2E flows pass on simulator, but still require attached simulator/emulator + installed dev app + E2E Metro (not yet CI-automated).
- Current iOS Simulator profile has no usable connectivity controls in Control Center, so the network-reconnect flow uses app-level fallback toggles when a real device toggle is unavailable.
- Snapshot recovery/re-hydration now includes student/course + absence/grade projections, but timetable/task projection snapshots are still pending.
- Setup still depends on tRPC choice endpoints for year/class/course selection; only local DB bootstrap writes were removed in this slice.
- Untis job idempotency and observability hardening is still pending.

## Next Steps

1. Add WS-C slice 3 snapshot projections for timetable/tasks and wire them into mobile re-hydration.
2. Reduce remaining setup-time tRPC dependencies where event/snapshot flow can replace them safely.
3. Run lifecycle network-reconnect flow on a simulator/device profile that exposes real connectivity controls and remove fallback dependence.
4. Start WS-E instrumentation + idempotency hardening for Untis background jobs.
