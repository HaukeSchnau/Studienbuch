# Studienbuch Monorepo

Studienbuch is a Bun + TypeScript monorepo for a local-first school platform.

Core product surfaces:

- `@stu/app-mobile`: Expo mobile app (primary product priority)
- `@stu/api`: standalone backend runtime for sync + business APIs
- `@stu/web`: web surface
- `@stu/admin-panel`: TanStack Start admin surface (incremental)
- `@stu/console`: CLI/background jobs

## Documentation

- Documentation index: `docs/README.md`
- Architecture: `docs/architecture/`
- Operations: `docs/operations/`
- Workspace package catalog: `docs/packages/README.md`
- Migration tracking: `docs/migration/`
- ADRs: `docs/adr/`

## Quick Start

### 1. Enter the environment

```bash
direnv allow
just doctor
```

### 2. Install dependencies

```bash
just install
```

### 3. Start local development

```bash
just dev
```

This performs preflight checks, preloads OCI images, starts Docker services, and opens relevant local UIs.

## Common Commands

```bash
# Environment and stack
just doctor
just dev
just live-up
just live-up-dev
just live-up-dev-debug
just live-down
just live-health-all

# Workspace quality gates
bun run lint
bun run test
bun run ci

# Console jobs
just console -- --help
just console pull --school=igs-lil
just console bootstrap-broadcast

# DB and artifacts
just clone-prod-db
just oci-build
just oci-export
just oci-load
```

## Runtime Topology

- **API runtime boundary:** `@stu/api` is the backend runtime used for sync/event ingestion (`POST /api/events`), stream replay/live consumption (`GET /api/events`), snapshots (`POST /api/snapshot`), and tRPC.
- **Server persistence:** Postgres (canonical state + event storage).
- **Client persistence:** SQLite on mobile (local read model + local event log).
- **Streaming:** RabbitMQ Streams for durable event fanout (with in-memory/dev modes where applicable).

See `docs/architecture/runtime-topology.md` and `docs/architecture/sync-and-events.md`.

## Monorepo Structure

- `packages/`: product and domain packages
- `tooling/`: shared workspace tooling packages
- `docs/`: long-form project documentation
- `nix/`: flake parts for dev shell, build, and OCI artifacts

Package-level documentation lives in `packages/*/README.md` and `tooling/*/README.md`.
