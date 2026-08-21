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

## Layout

`index.ts` is the only entry point. Implementation is grouped by capability: `database/` holds the
pooled client, the migration runner and the migration bookkeeping; `auth/` holds the Better Auth
configuration next to the tables it must agree with.

## Authentication

`Auth` builds Better Auth against the same pool. It lives here rather than in the web app because
everything it configures has to agree with `auth/schema.ts`: the model names, `generateId: false`
(which lets PostgreSQL own identity through `defaultRandom()`), and the pool itself.

Better Auth's Drizzle adapter expects a Promise-based instance and cannot consume
`EffectPgDatabase`, so it runs through the Kysely adapter on the raw pool. That is a deliberate
trade, and it has one consequence worth naming: `db:generate` cannot see `auth.ts`, so nothing but
agreement keeps the mapping and the migration history in step. `database.integration.test.ts` signs
a user up through Better Auth and reads the row back out of `users`, so a renamed table or column
fails the build instead of first login.

Applications supply their own plugins and trusted origins. `tanstackStartCookies()` is a web
concern and `expo()` a mobile one, and neither belongs in a package that only knows about the
database.

There is deliberately no generic repository, domain schema, sync protocol, or event log yet. Add a
domain table with the first server use case that needs it, and keep the workflow behind a narrow
Effect module rather than exposing Drizzle queries to route handlers.

## Commands

Set `DATABASE_URL`, then run:

```bash
just db-generate
just db-migrate
```

`just db-migrate` is a convenience for development. A deployed Release applies pending migrations
as a staged pre-deploy task before the active artifact or web process changes.
Both paths record their work in `public.studienbuch_migrations`; the table and schema names live in
`src/database/migration-history.ts` so the two cannot drift.

A bundled server has no workspace neighbours to resolve `drizzle/` against, so the Nix release
copies the history beside the bundle and sets `STUDIENBUCH_MIGRATIONS_DIR`.

`vp run --filter @stu/server test` starts PostgreSQL with Testcontainers, applies the real migration
history, and exercises the Effect Drizzle client. The flake development shell points `DOCKER_HOST`
at the current user's Podman socket when one exists and the variable is unset; ordinary Docker
environments require no special configuration.
