# Effect + Local-First Migration Progress

Status: Active  
Last updated: 2026-02-15

## Scope Lock

- backend runtime: standalone API only (`@stu/api`)
- top priority: mobile offline-first sync correctness
- required parity: cross-device sync for absences and grades
- parallel priority: Untis school structure and timetable background jobs
- non-priority for now: Next.js admin rewrite (future TanStack Start/Router)

## Completed In This Iteration

- Added `studentId` to all sensitive domain events:
  - `absence.*`
  - `grades.*`
- Implemented server applicators in `@stu/db` for:
  - `absence.*`
  - `grades.*`
- Added database repositories for server-side absence/grade application:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/db/src/repositories/absence.repo.ts`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/db/src/repositories/grade.repo.ts`
- Registered applicators and repositories in runtime wiring:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/db/src/index.ts`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/api/src/groundswell.ts`
- Added private user topic routing for sensitive sync:
  - `students.user.<studentId>`
- Updated all mobile absence/grade emitters to include `studentId`.

## Current Workstream Status

- WS-A Sync transport and broadcast reliability: in progress
- WS-B Server applicator parity: in progress (core implementation done, integration tests pending)
- WS-C Snapshot and bootstrap strategy: not started
- WS-D Mobile app stabilization: in progress
- WS-E Untis background jobs: not started in code
- WS-F Quality gates and CI: in progress

## Checks

- `bun run lint`: PASS
- `bun run typecheck`: PASS
- `bun run ci`: PASS (fixed root `ci` script to remove missing `format` task)
- `bun run test`: FAIL (pre-existing external dependency/test-suite issues)
  - `@stu/external-api` Untis tests fail with `NO_MANDANT`
  - `@stu/api` contains an empty `events.test.ts` suite

No new failures attributable to this migration slice were observed in lint/typecheck gates.

## Known Risks / Gaps

- Cross-device integration behavior for absences/grades is not yet covered by dedicated tests.
- Broadcast + replay + offset path still needs end-to-end verification against private topics.
- Snapshot-based unknown-entity recovery remains unimplemented.
- Untis job idempotency and observability hardening is still pending.

## Next Steps

1. Add integration tests for absence/grades replay + cross-device propagation.
2. Complete WS-A replay/broadcast offset validation using private user topics.
3. Stabilize test gates by isolating Untis-dependent tests and fixing/removing empty API suite placeholders.
4. Start WS-C snapshot API + client resolver implementation.
