# Studienbuch Monorepo

## Development Setup (with `direnv`)
```bash
direnv allow
just doctor
just dev # Builds/loads OCI images and starts local services
```

## Primary Commands
```bash
just doctor # Preflight checks (env, ports, compose resolution, tooling)
just dev # OCI-first local development flow
just live-up # Start live-profile stack (no host port bindings)
just live-up-dev # Start live-profile stack with dev port bindings
just live-health # Check API readiness (DB + event stream)
just live-down # Stop and remove live-profile stack
just oci-export # Export OCI archives to .artifacts/oci
just oci-load # Load OCI archives into local Docker daemon
just console -- --help # Run console CLI commands
just clone-prod-db # Clone production DB into local postgres
just visualize-deps # Regenerate workspace dependency graph image
```

## Daily Workflow
See [docs/DailyWorkflow.md](docs/DailyWorkflow.md).

## Dev Port Overrides
`live-up-dev` port mappings can be overridden with:
`STU_DATABASE_PORT`, `STU_LEGACY_DATABASE_PORT`, `STU_EVENT_STREAM_PORT`, `STU_AMQP_PORT`, `STU_EVENT_STREAM_UI_PORT`, `STU_API_PORT`.
