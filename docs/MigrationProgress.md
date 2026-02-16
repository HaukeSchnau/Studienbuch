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

- Implemented server broadcast behavior in `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/api/src/broadcast.ts`:
  - `publishToUser` marks canonical sent state and publishes live events.
  - duplicate `markEventAsSentToUser` writes are handled and do not re-publish.
  - memory and RabbitMQ broadcast paths now align on sent-marker behavior.
- Added replay-by-offset support in server subscription stream:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/api/src/broadcast.ts`
- Added broadcast integration tests:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/api/src/broadcast.test.ts`
  - verifies replay ordering, offset skip, duplicate marker behavior, and user stream isolation.
- Implemented mobile offset persistence while consuming SSE events:
  - `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/packages/app-mobile/src/utils/groundswell.tsx`
- Previous WS-B parity work (event contract + applicators + private topics) remains in place.

## Current Workstream Status

- WS-A Sync transport and broadcast reliability: in progress (core publish/replay/offset implementation done)
- WS-B Server applicator parity: in progress (core implementation + API integration tests done)
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

- End-to-end multi-device scenarios (full ingest + reconnect + second client convergence) still need dedicated tests.
- Snapshot-based unknown-entity recovery remains unimplemented.
- Untis job idempotency and observability hardening is still pending.

## Next Steps

1. Add integration tests for absence/grades replay + cross-device propagation.
2. Extend tests from API broadcast layer to full mobile sync runtime reconnect scenarios.
3. Start WS-C snapshot API + client resolver implementation.
4. Start WS-E instrumentation + idempotency hardening for Untis background jobs.
