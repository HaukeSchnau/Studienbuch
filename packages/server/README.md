# Server foundation

`@stu/server` owns code that can run only in the trusted server process. Its first module is the
PostgreSQL persistence seam:

- one scoped `pg` pool with startup validation and deterministic shutdown
- an Effect-native Drizzle client backed by that same pool
- a single migration history under `drizzle/`, applied in process at server start
- Better Auth's current-state tables as the initial schema

The pool deliberately keeps node-postgres' default type parsers. Better Auth queries this same pool
through its Kysely adapter, which is configured with `supportsDates: true` and therefore never
coerces strings back to `Date`; overriding the parsers there would silently break session expiry and
refresh. Drizzle needs no such override — its `effect-postgres` codecs cast date and timestamp
columns to text in SQL and decode them themselves.

There is deliberately no generic repository, domain schema, sync protocol, or event log yet. Add a
domain table with the first server use case that needs it, and keep the workflow behind a narrow
Effect module rather than exposing Drizzle queries to route handlers.

## Commands

Set `DATABASE_URL`, then run:

```bash
just db-generate
just db-migrate
```

`just db-migrate` is a convenience for development. The server also applies pending migrations
itself during startup, so a deployed Release never serves traffic against an unmigrated schema.
Both paths record their work in `public.studienbuch_migrations`; the table and schema names live in
`src/migration-history.ts` so the two cannot drift.

A bundled server has no workspace neighbours to resolve `drizzle/` against, so the Nix release
copies the history beside the bundle and sets `STUDIENBUCH_MIGRATIONS_DIR`.

`vp run --filter @stu/server test` starts PostgreSQL with Testcontainers, applies the real migration
history, and exercises the Effect Drizzle client. The test runner automatically uses the current
user's Podman socket when `DOCKER_HOST` is unset; ordinary Docker environments require no special
configuration.
