# Daily Development Workflow

## 1. Prepare Shell Environment
```bash
direnv allow
```

`direnv` loads `.env` and optional `.env.secrets`, then applies local defaults for non-secret values.

## 2. Run Preflight Checks
```bash
just doctor
```

This verifies:
- required env keys are set
- compose config resolves
- local ports are free
- Docker/Nix/Bun tooling is available
- external API endpoints are reachable

## 3. Install Dependencies
```bash
just install
```

`bun install` is always run and should be treated as part of normal setup.

## 4. Start the Live Stack
```bash
just live-up-dev
```

This default keeps host port exposure minimal (API only).
Use debug host bindings only when needed:
```bash
just live-up-dev-debug
```

Useful follow-up commands:
- `just live-health`
- `just live-logs api`
- `just live-logs console-cron`

## 5. Run Common Validation
```bash
bun run typecheck
bun test packages/api/src/broadcast.test.ts
bun test packages/api/src/sync.integration.test.ts
```

## 6. Run Console Jobs
```bash
just console pull --school=igs-lil
just console bootstrap-broadcast
just console prune-conflicts
```

## 7. Stop the Stack
```bash
just live-down
```

## Port Overrides (optional)
When default host ports are occupied, override this env var before `live-up-dev`:
- `STU_API_PORT`

When using `live-up-dev-debug`, you can additionally override:
- `STU_DATABASE_PORT`
- `STU_LEGACY_DATABASE_PORT`
- `STU_EVENT_STREAM_PORT`
- `STU_AMQP_PORT`
- `STU_EVENT_STREAM_UI_PORT`
