# Daily Development Workflow

## 1. Prepare Environment

```bash
direnv allow
just doctor
```

`direnv` loads `.env` and optional `.env.secrets`.
`just doctor` validates env keys, port availability, compose config, and toolchain availability.

## 2. Install Dependencies

```bash
just install
```

## 3. Start the Stack

Default local workflow:

```bash
just dev
```

Live profile workflows:

```bash
just live-up
just live-up-dev
just live-up-dev-debug
```

## 4. Validate Changes

```bash
bun run lint
bun run test
bun run typecheck
```

Targeted QA smoke checks:

```bash
just qa-smoke-services
just qa-smoke-console
# optional web/admin browser smoke:
just qa-smoke-web-admin
```

Targeted checks used frequently:

```bash
bun test packages/api/src/sync.integration.test.ts
bun test packages/api/src/snapshot.test.ts
bun --filter @stu/app-mobile maestro:test:lifecycle
```

## 5. Operational Commands

```bash
just console -- --help
just console pull --school=igs-lil
just console bootstrap-broadcast
```

## 6. Stop Services

```bash
just live-down
```

## Optional Port Overrides

For `live-up-dev`:

- `STU_API_PORT`
- `STU_NEXTJS_PORT`
- `STU_ADMIN_PANEL_PORT`

For `live-up-dev-debug` additionally:

- `STU_DATABASE_PORT`
- `STU_LEGACY_DATABASE_PORT`
- `STU_EVENT_STREAM_PORT`
- `STU_AMQP_PORT`
- `STU_EVENT_STREAM_UI_PORT`
