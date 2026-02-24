# @stu/app-mobile

Expo mobile client and primary product surface.

## Responsibilities

- Render student-facing UX (agenda, profile, absences, grades, setup flows).
- Persist local state in SQLite.
- Run local-first event ingest + replay runtime.
- Recover missing references through snapshot hydration.

## Key Files

- `src/app/_layout.tsx`: app bootstrapping and runtime lifecycle control.
- `src/utils/groundswell.tsx`: sync runtime wiring.
- `src/utils/snapshot-recovery.ts`: apply-time snapshot recovery.
- `src/utils/sync-lifecycle.ts`: resume/reconnect refresh logic.
- `src/features/`: feature modules.
- `drizzle/`: local DB migrations.

## Scripts

```bash
bun --filter @stu/app-mobile dev
bun --filter @stu/app-mobile dev:ios
bun --filter @stu/app-mobile dev:android
bun --filter @stu/app-mobile lint
bun --filter @stu/app-mobile typecheck
bun --filter @stu/app-mobile maestro:test
bun --filter @stu/app-mobile maestro:test:lifecycle
```

## Internal Dependencies

- `@stu/expo-native`
- `@stu/lib`
- `@stu/student`
- type-only/dev integration with `@stu/api`

## Testing

- Unit/runtime tests in `src/utils/*.test.ts`.
- E2E lifecycle and replay coverage through Maestro flows in `maestro/flows/`.

E2E runbook: `maestro/README.md`.

## Related Docs

- `docs/architecture/sync-and-events.md`
- `docs/operations/daily-workflow.md`
