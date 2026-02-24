# @stu/legacy-import

Legacy database import helpers used for migration and backfill workflows.

## Responsibilities

- Connect to legacy Postgres source.
- Define legacy schema/relations for import operations.
- Upsert discovered courses into target structures.

## Key Files

- `src/client.ts`: legacy DB connection (`LEGACY_DATABASE_URL`).
- `src/schema.ts`: legacy schema definitions.
- `src/relations.ts`: relation graph.
- `src/index.ts`: import helpers including `upsertCourses`.

## Scripts

```bash
bun --filter @stu/legacy-import lint
bun --filter @stu/legacy-import lint
bun --filter @stu/legacy-import push
bun --filter @stu/legacy-import studio
```

## Testing

No dedicated package-local automated tests are currently present.
Use controlled DB snapshots and command-level verification.
