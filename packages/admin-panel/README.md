# @stu/admin-panel

TanStack Start admin application.

## Responsibilities

- Provide admin-focused interfaces (currently timetable-centric).
- Consume shared repositories/runtime layers from workspace packages.
- Serve as an incremental path for future admin migration.

## Key Files

- `src/routes/__root.tsx`: app shell and global providers.
- `src/routes/index.tsx`: main route.
- `src/router.tsx`: router setup.
- `src/runtime.ts`: Effect runtime composition.

## Scripts

```bash
bun --filter @stu/admin-panel dev
bun --filter @stu/admin-panel build
bun --filter @stu/admin-panel serve
bun --filter @stu/admin-panel start
bun --filter @stu/admin-panel lint
bun --filter @stu/admin-panel typecheck
```

## Internal Dependencies

- `@stu/api`
- `@stu/db`
- `@stu/lib`

## Testing

No package-local automated test suite is currently defined.
Rely on typecheck/build/manual route verification and workspace test gates.
