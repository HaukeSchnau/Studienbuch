# @stu/nextjs

Next.js web application for existing public/admin workflows.

## Responsibilities

- Serve web pages and admin routes.
- Connect client and server components to shared API/domain packages.
- Host tRPC route handlers for app integration.

## Key Files

- `src/app/layout.tsx`: global app shell.
- `src/app/api/trpc/[trpc]/route.ts`: tRPC endpoint.
- `src/app/admin/`: admin route tree.
- `src/infrastructure/trpc/`: query client and providers.

## Scripts

```bash
bun --filter @stu/nextjs dev
bun --filter @stu/nextjs build
bun --filter @stu/nextjs start
bun --filter @stu/nextjs lint
bun --filter @stu/nextjs typecheck
```

Note: `typecheck` is currently a placeholder command in `package.json`.

## Internal Dependencies

- `@stu/api`
- `@stu/db`
- `@stu/lib`
- `@stu/lib-server`

## Testing

No dedicated package-local test suite is currently configured.
Use `build`, route-level manual checks, and repository-wide test gates.

## Related Docs

- `docs/architecture/runtime-topology.md`
- `docs/migration/effect-local-first-plan.md`
