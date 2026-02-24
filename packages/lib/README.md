# @stu/lib

Shared domain core for the entire monorepo.

## Responsibilities

- Define domain entities, value objects, and event contracts.
- Provide shared repository logic and cross-storage business rules.
- Define snapshot contracts and mapping helpers.
- Export common infrastructure helpers used by runtime packages.

## Key Files

- `src/index.ts`: central export surface.
- `src/events.ts`: event contract definitions.
- `src/repository-logic/`: reusable domain repository logic.
- `src/snapshot.ts` and `src/snapshot/`: snapshot contracts and mappers.
- `src/data-model/`: cross-package contract/parity helpers.

## Scripts

```bash
bun --filter @stu/lib lint
bun --filter @stu/lib typecheck
```

## Testing

Key suites include:
- `src/student-event-logic.test.ts`
- `src/org-event-logic.test.ts`
- `src/snapshot.test.ts`
- `src/repository-logic/*.test.ts`

## Notes

`ensureEntityDefined` and `RequiredEntityNotFoundError` are shared primitives used across packages to enforce explicit missing-entity handling.

## Related Docs

- `docs/architecture/domain-model.md`
- `docs/architecture/sync-and-events.md`
