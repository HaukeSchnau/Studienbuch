# Server foundation

`@stu/server` owns code that can run only in the trusted server process. Its first module is the
PostgreSQL persistence seam:

- one scoped `pg` pool with startup validation and deterministic shutdown
- an Effect-native Drizzle client backed by that same pool
- a single migration history under `drizzle/`
- Better Auth's current-state tables as the initial schema

There is deliberately no generic repository, domain schema, sync protocol, or event log yet. Add a
domain table with the first server use case that needs it, and keep the workflow behind a narrow
Effect module rather than exposing Drizzle queries to route handlers.

## Commands

Set `DATABASE_URL`, then run:

```bash
just db-generate
just db-migrate
```

`vp run --filter @stu/server test` starts PostgreSQL with Testcontainers, applies the real migration
history, and exercises the Effect Drizzle client. The test runner automatically uses the current
user's Podman socket when `DOCKER_HOST` is unset; ordinary Docker environments require no special
configuration.
