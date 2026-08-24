# Server foundation

`@stu/server` owns code that can run only in the trusted server process. Its first module is the
PostgreSQL persistence seam:

- one scoped `pg` pool with startup validation and deterministic shutdown
- an Effect-native Drizzle client backed by that same pool
- a single migration history under `drizzle/`, applied in process at server start
- Better Auth's current-state tables as the initial schema
- incremental provider records with immutable payload versions and per-poll change manifests

The pool deliberately keeps node-postgres' default type parsers. Better Auth queries this same pool
through its Kysely adapter, which is configured with `supportsDates: true` and therefore never
coerces strings back to `Date`; overriding the parsers there would silently break session expiry and
refresh. Drizzle needs no such override — its `effect-postgres` codecs cast date and timestamp
columns to text in SQL and decode them themselves.

## Layout

`index.ts` is the only entry point. Implementation is grouped by capability. `database/` holds the
pooled client, migration runner and migration bookkeeping. `auth/` holds the Better Auth
configuration next to the tables it must agree with. `importing/` owns durable provider
observations, while `webuntis/` fetches and normalizes that provider's data.

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

There is deliberately no generic repository, domain projection schema, sync protocol, or domain
event log yet. The import store records what a provider said without pretending that every
WebUntis activity is already a Studienbuch subject or course. Its source changes are an ingestion
manifest, not application events. Add domain tables with the first projection that needs them, and
keep the workflow behind a narrow Effect module rather than exposing Drizzle queries to route
handlers.

## WebUntis directory imports

The console previews by default and only opens PostgreSQL when `--apply` is explicit:

```bash
just console webuntis-directory --school-year 2026/2027
just console webuntis-directory --school-year 2026/2027 --apply
just console webuntis-timetable --school-year 2026/2027 --start 2026-08-24 --end 2026-08-28
just console webuntis-timetable --school-year 2026/2027 --start 2026-08-24 --end 2026-08-28 --apply
```

Every successful applied poll gets a small immutable run record, including its completeness,
diagnostics and record-level change counts. A transaction-scoped advisory lock serializes imports
for the same data source, dataset and academic year. Within that transaction, `source_records`
tracks the current provider identity and `source_record_versions` stores a payload only when its
hash is new. `source_changes` names added, updated, removed and reactivated identities for the run.
The current-run pointer moves only after all transitions succeed.

An unchanged poll therefore adds one run but no payload versions or change rows. A complete poll
may remove identities it no longer contains; a partial poll never interprets absence as deletion.
If an old payload reappears, its immutable version is reused. This keeps frequent timetable and
substitution polling cheap without losing provenance or the ability to project only actual changes.
The observed IGS payloads, reconciliation scopes and proposed polling policy are recorded in
[`docs/webuntis-ingestion.md`](../../docs/webuntis-ingestion.md).

The timetable command fetches all class views in batches of ten and splits the requested range into
daily scopes. Missing, denied, conflicting or provider-error rows make the affected day partial, so
that poll may add or update records but cannot delete records previously observed for the day.

## Commands

Set `DATABASE_URL`, then run:

```bash
just db-diagram
just db-generate
just db-migrate
```

`just db-diagram` evaluates the configured Drizzle schemas through `drizzle-kit export`, lets Atlas
load the resulting PostgreSQL schema in a disposable development database, and updates
[`docs/database-schema.mmd`](../../docs/database-schema.mmd) and
[`docs/database-schema.svg`](../../docs/database-schema.svg). The Mermaid source is the reviewable
schema artifact; the SVG is its rendered form. Atlas 1.3.0 treats every foreign key as optional in
Mermaid output, so the Nix package temporarily applies
[the proposed upstream fix](https://github.com/HaukeSchnau/atlas/commit/d1473c52a58401c383cd8f83b60470960c50f1c5)
until it is available in a release.

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
