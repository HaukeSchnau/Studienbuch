# Effect + Local-First Migration Progress

Status: Active  
Last updated: 2026-02-16

## Scope Lock

- backend runtime: standalone API only (`@stu/api`)
- top priority: mobile offline-first sync correctness
- required parity: cross-device sync for absences and grades
- parallel priority: Untis school structure and timetable background jobs
- non-priority for now: Next.js admin rewrite (future TanStack Start/Router)

## Completed In This Iteration

- Added ingest-to-broadcast integration tests in:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/api/src/sync.integration.test.ts`
- Added Expo lifecycle sync coverage and runtime refresh behavior in:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/src/utils/sync-lifecycle.ts`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/src/utils/sync-lifecycle.test.ts`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/src/app/_layout.tsx`
- Added Maestro E2E harness and lifecycle flows in:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/src/app/e2e/sync-lifecycle.tsx`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/maestro/flows/sync-lifecycle-resume.yml`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/maestro/flows/sync-lifecycle-replay.yml`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/maestro/flows/shared/open-sync-lifecycle.yml` (iOS prompt/Expo launcher resilient open path)
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/maestro/README.md`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/flake.nix` (adds direct `maestro` in dev shell)
- Executed Maestro lifecycle suite on iOS Simulator (`iPhone 17 Pro`, iOS 26.2) with passing resume/replay flows.
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
    - `grades.latestRestored`.
- Existing broadcast and offset persistence implementation remains active:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/api/src/broadcast.ts`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/src/utils/groundswell.tsx`

## Current Workstream Status

- WS-A Sync transport and broadcast reliability: in progress (core implementation + server and client-runtime integration coverage done)
- WS-B Server applicator parity: in progress (`absence.*` + `grades.*` server coverage done; sensitive grades convergence matrix expanded)
- WS-C Snapshot and bootstrap strategy: not started
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
- Real network transition toggling is not yet automated in Maestro flows (AppState and relaunch replay are covered).
- Snapshot-based unknown-entity recovery remains unimplemented.
- Untis job idempotency and observability hardening is still pending.

## Next Steps

1. Extend Maestro lifecycle suite with real network toggling (offline -> online) and replay assertions.
2. Add reconnect replay scenarios for sensitive grade flows while one device is offline.
3. Start WS-C snapshot API + client resolver implementation.
4. Start WS-E instrumentation + idempotency hardening for Untis background jobs.
