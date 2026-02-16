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
- New integration coverage now verifies:
  - one ingested event reaches multiple live subscribers for the same user (cross-device),
  - reconnect replay from `offset` returns only missing events (no duplicate re-delivery),
  - user-stream isolation (no leakage to other users).
- Existing broadcast and offset persistence implementation remains active:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/api/src/broadcast.ts`
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/src/utils/groundswell.tsx`

## Current Workstream Status

- WS-A Sync transport and broadcast reliability: in progress (core implementation + ingest integration tests done)
- WS-B Server applicator parity: in progress (core implementation + integration tests done)
- WS-C Snapshot and bootstrap strategy: not started
- WS-D Mobile app stabilization: in progress
- WS-E Untis background jobs: not started in code
- WS-F Quality gates and CI: in progress

## Checks

- `bun run lint`: PASS
- `bun run typecheck`: PASS
- `bun run test`: PASS
- `bun run ci`: PASS (root `ci` uses lint + typecheck)

All current project checks pass in this iteration.

## Known Risks / Gaps

- Full mobile runtime reconnect scenarios are not yet tested end-to-end (client storage + transport + UI lifecycle).
- Snapshot-based unknown-entity recovery remains unimplemented.
- Untis job idempotency and observability hardening is still pending.

## Next Steps

1. Extend tests from API ingest/broadcast integration to full mobile sync runtime reconnect scenarios.
2. Add absence/grades-specific end-to-end scenarios on top of current sync integration harness.
3. Start WS-C snapshot API + client resolver implementation.
4. Start WS-E instrumentation + idempotency hardening for Untis background jobs.
