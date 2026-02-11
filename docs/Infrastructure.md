# Infrastructure

Status: aligned with architecture lock from `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/docs/adr/0001-standalone-api-mobile-priority.md`.

## Runtime Topology

- Standalone API service (`@stu/api`) is the only backend runtime.
- Mobile app (`@stu/app-mobile`) is the primary product priority.
- Next.js admin remains temporarily for existing workflows and is not a migration priority.
- Long-term admin direction is TanStack Start / TanStack Router, but this is intentionally deferred.

## Data Stores

- Postgres: management and canonical event storage (server-side).
- SQLite (device-local): mobile read model and local event log.
- RabbitMQ Streams: optional/production event bus for fanout.

## Services

- API (`@stu/api`)
  - tRPC endpoints (legacy and transitional).
  - sync endpoints (`/api/events`) for ingest + SSE stream.
  - event verification, application, canonical storage, topic fanout.
- Console/background jobs (`@stu/console`)
  - Untis import jobs (teachers/classes/timetables).
  - seed and maintenance jobs.
- Mobile (`@stu/app-mobile`)
  - offline-first local database.
  - local event ingestion + remote sync engine.

## Deferred / Not In Scope For Current Migration

- MongoDB and Neo4j event architecture variants.
- Next.js admin rewrite.
