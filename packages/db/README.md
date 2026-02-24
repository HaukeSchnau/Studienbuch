# @stu/db

Server-side Postgres schema, repositories, and event applicators.

## Responsibilities

- Define canonical Postgres schema with Drizzle.
- Provide repository implementations for domain interfaces.
- Provide server applicator tree for event application.
- Support migration tooling and live DB integration tests.

## Public Surface

From `src/index.ts`:

- `applicators`
- `Database` layer exports
- repository exports
- schema/table exports
- selected `drizzle-orm` re-exports

## Key Files

- `src/database.ts`, `src/client.ts`: DB layer and client wiring.
- `src/schema/`: table definitions by domain.
- `src/repositories/`: repository implementations.
- `src/event-handlers/`: namespace applicators.
- `drizzle.config.ts`: schema generation/push config.

## Scripts

```bash
bun --filter @stu/db lint
bun --filter @stu/db typecheck
bun --filter @stu/db generate
bun --filter @stu/db push
bun --filter @stu/db test:live
```

## Testing

- `src/applicators.integration.test.ts`
- `src/applicators.live.integration.test.ts`
- `src/schema-parity.test.ts`

These cover applicator behavior and parity guarantees with shared contracts.

## Related Docs

- `docs/architecture/domain-model.md`
- `docs/architecture/sync-and-events.md`
