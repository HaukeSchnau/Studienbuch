# ADR 0001: Standalone API And Mobile-First Migration Priority

- Status: Accepted
- Date: 2026-02-11
- Decision owners: Product + Engineering

## Context

The project is migrating to Effect and a local-first architecture. During migration, we currently have mixed runtime patterns:

- Effect-based sync/runtime components and applicators.
- legacy tRPC router surfaces and direct DB CRUD paths.
- two potential backend access paths (standalone API and framework-embedded API routes).

This creates unclear ownership and slows stabilization of offline-first mobile behavior.

## Decision

1. Keep only the standalone API (`@stu/api`) as backend runtime.
2. Prioritize the mobile app and offline-first sync correctness above all other migration work.
3. Keep the Next.js admin area temporarily for continuity, but treat it as non-priority for this migration.
4. Long-term admin direction is rewrite to TanStack Start / TanStack Router.
5. Absence and grades must sync cross-device for the same user.

## Consequences

### Positive

- Single backend runtime reduces integration ambiguity.
- Clear priority stack improves delivery speed: mobile sync and Untis background jobs first.
- Event/topic design can now explicitly support sensitive user-private sync (absence/grades).

### Tradeoffs

- Next.js admin technical debt remains for now.
- Temporary dual patterns (Effect-first + legacy endpoints) will exist until migration completion.
- Team must maintain strict boundaries so non-priority admin work does not absorb capacity.

## Implementation Implications

- All sync transport and ingest reliability work targets the standalone API only.
- Server applicator coverage must include all mobile-emitted events, especially `absence.*` and `grades.*`.
- Topic model must include private user topics for sensitive events.
- Background ingestion jobs (Untis) must be idempotent, observable, and compatible with the standalone API event model.

## Validation Criteria

- Mobile clients can ingest offline, reconnect, replay by offset, and converge across devices.
- Absence/grades updates performed on device A are visible on device B for the same user.
- Untis jobs keep school structure/timetables current without duplicates or destructive regressions.
- No production-critical path depends on framework-embedded API runtime.

## Implementation Status

### 2026-02-15

- implemented: user-private topic naming `students.user.<studentId>` is wired for sensitive sync.
- implemented: event payload contract for all `absence.*` and `grades.*` events includes `studentId`.
- implemented: server-side applicators for `absence.*` and `grades.*` are present in `@stu/db`.
- implemented: mobile emission paths include `studentId` and align with standalone API verification.

### 2026-02-16

- implemented: standalone API broadcast layer now persists sent markers and streams replay + live events by user.
- implemented: offset-based replay behavior is wired in broadcast subscribe path.
- implemented: mobile transport persists `sync.offset` while consuming server events.
- implemented: API integration tests now cover replay ordering, offset skip behavior, duplicate marker handling, and user stream isolation.
- implemented: ingest-to-broadcast multi-device convergence tests are in place.
- implemented: client sync-runtime reconnect tests now cover persisted-offset resume and same-user convergence for absences and grades.
- implemented: Expo lifecycle transition controller and tests cover resume/reconnect runtime refresh behavior in `@stu/app-mobile`.
- implemented: lifecycle replay test coverage now includes simulated offline/background -> reconnect missed-event replay.
- implemented: sensitive grades convergence matrix now includes `teacherApproved`, `parentApproved`, and `latestRestored`.
- implemented: one-device-offline replay convergence coverage now includes sensitive grade flows (`teacherApproved`, `parentApproved`, `latestRestored`).
- implemented: unauthorized sensitive-grade ingest attempts are now covered by reconnect replay guards and confirmed non-replayed after one-device-offline transitions (`teacherApproved`, `parentApproved`, `latestRestored`).
- implemented: Maestro-based lifecycle E2E harness is in place (`@stu/app-mobile`) and passing on iOS Simulator for resume and relaunch replay flows.
- implemented: Maestro lifecycle suite now includes offline -> online reconnect replay verification (`sync-lifecycle-network-reconnect.yml`).
- implemented: Maestro lifecycle suite now includes sensitive-grade auth rejection on reconnect with runtime + replay assertions (`sync-lifecycle-sensitive-auth-reconnect.yml`).
- pending: validate pure real connectivity toggling on simulator/device profiles that expose network controls; current simulator profile falls back to E2E offline/online controls when real toggles are unavailable.

### 2026-02-17

- implemented: WS-C slice 1 snapshot contract is now shared in `@stu/lib` for `student` and `course` entities.
- implemented: standalone API now serves authenticated snapshot pulls via `POST /api/snapshot`.
- implemented: mobile sync apply runtime now performs missing-reference recovery by snapshot fetch + local apply + retry.
- implemented: unit tests cover resolver dedupe behavior and runtime recovery retry behavior.
- pending: expand snapshot contracts to absence/grade projections and remove setup-time bootstrap writes.
