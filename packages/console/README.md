# @stu/console

Operational CLI and background command entrypoint.

## Responsibilities

- Run school/Untis pulls and schedule imports.
- Seed and maintenance tasks.
- License generation and maintenance utilities.
- Broadcast bootstrapping and conflict diagnostics.

## Key Files

- `src/console.ts`: CLI command registration and runtime wiring.
- `src/kadmos/`: Untis/Kadmos ingestion flow.
- `src/seed/`: seed commands.
- `src/env.ts`: environment parsing.

## Scripts

```bash
bun --filter @stu/console typecheck
```

CLI commands are typically invoked through root helpers:

```bash
just console -- --help
just console pull --school=igs-lil
```

## Internal Dependencies

- `@stu/api`
- `@stu/db`
- `@stu/external-api`
- `@stu/legacy-import`
- `@stu/lib`

## Testing

No package-local automated suite is currently configured.
Validation is command-driven and integrated with wider sync/import checks.
