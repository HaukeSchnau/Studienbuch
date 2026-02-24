# @stu/api

Standalone backend runtime for Studienbuch.

## Responsibilities

- Expose sync transport endpoints (`/api/events`, `/api/snapshot`).
- Expose tRPC router consumed by web/mobile clients.
- Orchestrate verification/application/broadcast of domain events.
- Provide bootstrapping utilities for missing-event marking.

## Key Files

- `src/index.ts`: public exports and bootstrap helpers.
- `src/base.ts`: runtime/service composition.
- `src/root.ts`: top-level router composition.
- `src/router/`: current domain routers.
- `src/router-legacy/`: legacy router surfaces still in tree.
- `src/services/`: sync/snapshot/session/topic service layer.
- `bin/bun.ts`, `bin/node.ts`: runtime entry points.

## Scripts

```bash
bun --filter @stu/api dev
bun --filter @stu/api dev:internal
bun --filter @stu/api lint
bun --filter @stu/api typecheck
```

## Internal Dependencies

- `@stu/db`
- `@stu/lib`
- `@stu/lib-server`
- `@stu/student`

## Testing

Primary tests live in `src/*.test.ts` and include sync + snapshot integration coverage.

Examples:

```bash
bun test packages/api/src/sync.integration.test.ts
bun test packages/api/src/snapshot.test.ts
bun test packages/api/src/base.snapshot.test.ts
```

## Related Docs

- `docs/architecture/runtime-topology.md`
- `docs/architecture/sync-and-events.md`
- `docs/migration/architecture-refactor-execution-plan.md`
