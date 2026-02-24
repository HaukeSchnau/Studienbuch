# @stu/student

Student/local SQLite schema, repositories, and applicators.

## Responsibilities

- Maintain local student-facing read model in SQLite.
- Apply domain events in local runtime contexts.
- Provide snapshot application helpers for hydration/recovery.
- Mirror core contract shape from `@stu/lib` and `@stu/db`.

## Public Surface

From `src/index.ts`:
- `applicators`
- database exports
- repositories
- snapshot apply helpers
- schema utility exports

## Key Files

- `src/database.ts`: local DB layer.
- `src/schema/`: local schema modules.
- `src/repositories/`: read/write operations.
- `src/event-handlers/`: local applicator namespaces.
- `src/snapshot/apply-snapshot.ts`: snapshot materialization.

## Scripts

```bash
bun --filter @stu/student lint
bun --filter @stu/student typecheck
```

## Testing

- `src/applicators.integration.test.ts`
- `src/schema-parity.test.ts`
- `src/snapshot/apply-snapshot.test.ts`

## Related Docs

- `docs/architecture/domain-model.md`
- `docs/architecture/sync-and-events.md`
