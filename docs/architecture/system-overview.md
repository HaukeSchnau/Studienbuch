# System Overview

## Goals

Studienbuch is designed around:
- local-first mobile UX
- deterministic sync and replay
- shared domain contracts across server and clients
- clear package boundaries in a single monorepo

## High-Level Boundaries

- `@stu/lib`: shared domain contracts, event models, repository logic, snapshot contracts.
- `@stu/db`: server-side Postgres schema, repositories, and event applicators.
- `@stu/student`: client/local SQLite schema, repositories, and applicators for student-facing state.
- `@stu/api`: standalone backend runtime (HTTP + tRPC + sync/snapshot orchestration).
- `@stu/lib-server`: server-side utility layer (auth/session, notifications, schedule/PDF helpers).
- `@stu/external-api`: typed integrations for Untis, holidays, Linear, and shared HTTP resilience.
- `@stu/app-mobile`: Expo client with local DB + ingest/snapshot sync runtime.
- `@stu/nextjs`: existing web/admin surface.
- `@stu/admin-panel`: TanStack Start admin application.
- `@stu/console`: operational CLI/background tasks.
- `@stu/legacy-import`: legacy data migration/import helpers.

## Data and Event Flow Summary

1. Client action emits a domain event.
2. Event is validated/applied locally for fast UX.
3. Unsynced events are ingested to API.
4. API validates, applies to canonical storage, and publishes to user/topic streams.
5. Other clients replay missing events from offset and continue live.
6. If replay references unknown entities, clients request snapshots and retry apply.

See `sync-and-events.md` for details and invariants.

## Deployment and Local Dev Model

- Development and local integration use Docker Compose + Nix-provided OCI artifacts.
- Services include Postgres, RabbitMQ Streams, API, web/admin surfaces, and console jobs.
- Runtime health checks and startup are orchestrated via `Justfile` tasks.
