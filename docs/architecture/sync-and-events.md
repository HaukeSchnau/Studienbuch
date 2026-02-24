# Sync and Event Architecture

## Requirements

- Mobile remains usable offline for most workflows.
- Clients synchronize automatically once online.
- Absence and grade state converges across devices for the same user.

## Event Lifecycle

1. Client writes event to local log.
2. Event is verified/applied locally (optimistic local-first behavior).
3. Sync engine ingests unsynced events to API (`POST /api/events`).
4. API verifies/applies events and stores canonical results.
5. API publishes events to user/topic streams.
6. Clients consume replay + live streams (`GET /api/events`) using offset checkpoints.

## Source of Truth

- Canonical state: server-side Postgres read model and canonical event storage.
- Local state: device SQLite read model and local event log.
- Transport: ingest + replay/live stream via standalone API.

## Topics

### Course Topics

Used for course-scoped updates (examples):

- `org.courses.created`
- `org.timetable.entryCreated`
- `org.timetable.substituted`
- `org.timetable.canceled`

### Year Topics

Used for year/school calendar updates (examples):

- `org.holiday.created`
- `org.year.started`
- `org.school.founded`

### User-Private Topics

Sensitive student data is published to one topic per student/user.

- naming: `students.user.<studentId>`
- payload requirement: every `absence.*` and `grades.*` event carries `studentId`
- examples: `absence.recorded`, `grades.currentGradeSet`, `grades.parentApproved`

## Snapshot Recovery Model

When replay references entities not present locally:

1. Client identifies missing entity references.
2. Client requests snapshots from API (`POST /api/snapshot`).
3. Client applies snapshot state into local read model.
4. Client retries event application.

Snapshot behavior includes transitive dependency hydration where needed.

## Invariants

- Event ingest is idempotent at event ID level.
- Replay is ordered per user/topic stream.
- Reconnect uses client offset to fetch only missing events.
- No mobile event namespace should silently drop due to missing server applicator.
- Sensitive events remain topic/authorization scoped by `studentId`.

## Operational Test Surfaces

- API integration tests (`packages/api/src/sync.integration.test.ts`, snapshot tests).
- Mobile lifecycle and replay tests (`packages/app-mobile/src/utils/*.test.ts`).
- Mobile E2E Maestro flows (`packages/app-mobile/maestro/flows/*`).
