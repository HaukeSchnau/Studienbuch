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
just live-up-dev # Start live-profile stack with API + web app host port bindings
just live-up-dev-debug # Start live-profile stack with additional DB/RabbitMQ host port bindings
just live-health # Check API readiness (DB + event stream)
just live-health-web # Check Next.js + TanStack Start HTTP readiness
just live-health-all # Run all health checks
just live-down # Stop and remove live-profile stack
just oci-build # Build OCI archives into the Nix store
just oci-export # Export OCI archives to .artifacts/oci
just oci-load # Load OCI archives into local Docker daemon (defaults to Nix store archives)
just console -- --help # Run console CLI commands
just clone-prod-db # Clone production DB into local postgres
just visualize-deps # Regenerate workspace dependency graph image
```

## Daily Workflow
See [docs/DailyWorkflow.md](docs/DailyWorkflow.md).

## Dev Port Overrides
`live-up-dev` maps:
`STU_API_PORT`, `STU_NEXTJS_PORT`, `STU_ADMIN_PANEL_PORT`.

`live-up-dev-debug` additionally maps:
`STU_DATABASE_PORT`, `STU_LEGACY_DATABASE_PORT`, `STU_EVENT_STREAM_PORT`, `STU_AMQP_PORT`, `STU_EVENT_STREAM_UI_PORT`.
