# Runtime Topology

## Primary Runtime Decision

The standalone API (`@stu/api`) is the backend runtime boundary.

- Sync endpoints live on API (`/api/events`, `/api/snapshot`).
- tRPC routes are composed in API and consumed by web/mobile clients.
- Background jobs operate through shared domain/repository packages and API contracts.

Related ADR: `docs/adr/0001-standalone-api-mobile-priority.md`.

## Services

From `docker-compose.yml`:

- `database`: Postgres 17 (canonical state)
- `event-stream`: RabbitMQ Streams (fanout/replay transport)
- `api`: standalone backend
- `nextjs`: web app
- `admin-panel`: TanStack Start admin app
- `console-cron`: scheduled console jobs
- `migrations`: one-shot schema migrations
- `legacy-database`: import source database

## Local Profiles

- `just live-up`: live profile without host port bindings.
- `just live-up-dev`: exposes app-facing host ports.
- `just live-up-dev-debug`: exposes app-facing + infra debug ports.

## Environment Model

Environment values are loaded by `direnv` and `tooling/with-env.sh` from:

- `.env`
- `.env.secrets` (optional local secrets)

Examples of required runtime values:

- `MANAGEMENT_DATABASE_URL`
- `PULSAR_URL`
- `LINEAR_API_KEY`
- `NEXT_PUBLIC_AXIOM_DATASET`
- `NEXT_PUBLIC_AXIOM_TOKEN`

## Build and Artifact Path

- Nix flake defines workspace apps/packages and OCI outputs.
- `just oci-build` builds OCI archives.
- `just oci-export` exports archives to `.artifacts/oci`.
- `just oci-load` loads archives into local Docker daemon.

## Health Verification

- `just live-health`: API health check
- `just live-health-web`: web/admin readiness checks
- `just live-health-all`: all above
