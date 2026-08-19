# Repository architecture audit — 2026-08-19

Scope: whole repository, weighted toward `packages/server` and `apps/web`. `apps/mobile` UI is out of
scope (mock data, to be replaced), but its telemetry module is included because it shares a protocol
with the web app.

Baseline verified at commit `38f652c4b`: `vp lint` clean, `vp run -r test` green (145 tests),
`tsc --noEmit` clean for every package. Nothing here is a build break; everything is structure,
correctness-under-load, or weight.

## The shape of the problem

| Area                                                           | Lines  | Consumers                      |
| -------------------------------------------------------------- | ------ | ------------------------------ |
| `packages/core` (domain model)                                 | 6,434  | mobile only, via a compat shim |
| `apps/mobile/src`                                              | 11,260 | mock data                      |
| Telemetry (obs pkg + web client + web ingress + mobile outbox) | ~2,200 | itself                         |
| `apps/web` product code (routes, UI)                           | ~10    | —                              |
| `packages/server`                                              | 223    | Better Auth tables only        |
| Docs + agent-notes                                             | 2,009  | —                              |

The domain model and the persistence layer have never met. `@stu/core` is not imported by
`@stu/server` or `apps/web` anywhere. Every seam that will actually hurt during growth — aggregate →
row, decode/encode at the DB edge, transaction boundaries, sync envelope — is still unexercised,
while significant effort has gone into an operational-telemetry platform that currently observes an
application that renders `null`.

The highest-value next unit of work is one vertical slice (tasks is the smallest) from
`@stu/core` aggregate → Drizzle table → Effect service in `@stu/server` → TanStack server function →
web route. Do that before adding more breadth anywhere.

## Correctness findings

### 1. The pg type-parser override corrupts Better Auth's dates — high

`packages/server/src/database.ts:32-39` installs a global `getTypeParser` that returns the raw string
for `timestamptz` (1184), `timestamp` (1114), `date` (1082) and friends. That `Pool` is handed
verbatim to Better Auth (`apps/web/src/lib/auth/auth.ts:11`).

Better Auth resolves a `pg.Pool` to its Kysely `postgres` dialect (`connect` in db →
`"postgres"`), and that dialect sets `supportsDates: true`, so its adapter factory does **not** coerce
string dates back to `Date` on output. Consequences in `better-auth/src/api/routes/session.ts`:

- line 322: `session.session.expiresAt.valueOf() - expiresIn * 1000 + updateAge * 1000` → with a
  string, `.valueOf()` returns the string, the arithmetic is `NaN`, `shouldBeUpdated` is always
  `false`, and **sessions silently never refresh**.
- line 277: `session.session.expiresAt < new Date()` becomes a lexicographic string comparison
  (`"2026-08-19 22:00:00+00"` vs `"Wed Aug 19 2026 …"`), so **expiry detection is arbitrary**.

Latent only because no sign-in surface exists yet. Fix: the override must not apply to the pool
Better Auth uses. Also verify the override is still needed at all — drizzle's `effect-postgres`
codecs already emit `::text` casts for `date`/`timestamp`/`timestamptz`
(`drizzle-orm/effect-postgres/codecs.js`), so the parser may be redundant for the Drizzle path too.

### 2. `postgresDateTypeIds` contains a non-date OID

`packages/server/src/database.ts:32` includes `1231`, which is `_numeric` (numeric array), not a date
type. Any future `numeric[]` column will come back as an unparsed string from a set explicitly named
"date type ids". Latent; remove it.

### 3. The Release never runs migrations

`project.json` gives development a `migrate` task workload gated ahead of `web`. The Release has
`"action": "web"` only, and `apps/web/nix.nix:releaseAction` execs the Nitro server directly. A
production deploy therefore runs against whatever schema the database happens to have.

`nix/checks.nix` does not catch this: `releaseSmoke` boots a fresh PostgreSQL with no tables and
passes, because readiness only reports whether the runtime object was constructed.

Fix: apply migrations at server startup with `migrate()` from
`drizzle-orm/effect-postgres/migrator` — the integration test already uses it — and ship
`packages/server/drizzle/` in the release payload. That also removes `drizzle-kit` and the whole
workspace checkout from the deployment path, which the current dev-only `migrationAction` requires.

### 4. Liveness and readiness are inverted

`apps/web/src/server.ts:6-9` warms the runtime and returns a plain-text `503` for **every** request
when it is not ready — including `/api/health/live` and `/api/health/ready` themselves. So:

- liveness fails whenever readiness fails, which tells the orchestrator to restart rather than to
  stop routing traffic — the exact distinction the two probes exist to make;
- `/api/health/ready` cannot return its own `{status:"not_ready"}` body.

`apps/web/src/server-adapters/health.server.test.ts` asserts "keeps liveness independent from
runtime readiness". That is true of the function and false of the deployed server, so the test gives
false confidence.

In the other direction: `applicationRuntimeState()` reports whether `ManagedRuntime` finished
building once. If PostgreSQL dies afterwards, the pool is not invalidated and `/api/health/ready`
keeps returning `200`. Readiness measures construction, not serving capacity.

### 5. Client Sentry and PostHog are compile-time disabled in the Nix release

`VITE_*` variables are inlined at build time. `apps/web/nix.nix` sets none of them, so in
`.output/public/assets`:

- `sentry-client-*.js` is `var e=!1;function t(){e||globalThis.window===void 0||(e=!0)}` — the entire
  `Sentry.init` call was dead-code-eliminated. Zero occurrences of `@sentry` or `sentry_key` in the
  main bundle. `apps/web/AGENTS.md` states "We use Sentry for deployed crash/error reporting"; as
  built, the release has no client crash reporting at all.
- `posthog-js` **is** fully bundled (`__PosthogExtensions__`, `surveys`, `rageclick` all present)
  because `provider.tsx` imports it at module scope, but `posthog.init` is eliminated for the same
  reason. Users download the SDK and it does nothing.

`index-*.js` is 557 KB for a page that renders `null`. Decide per tool: either thread the DSN/key
through the Nix build as build-time inputs, or make both runtime-configured and lazily imported the
way `sentry-client.ts` already is, or drop them until there are users.

## Simplification findings

### 6. Runtime warm-up is implemented three times

1. `apps/web/server/plugins/effect-runtime.ts` warms at Nitro startup and SIGTERMs the process on
   failure.
2. `apps/web/src/server.ts` awaits `warmApplicationRuntime()` on every request and 503s.
3. `apps/web/src/server-runtime/request.server.ts:22` awaits it again per route effect and returns
   `Exit.fail({_tag:"RuntimeUnavailable"})`.

Because (1) kills the process on failure, (2) and (3)'s failure branches are effectively dead. Keep
(1); delete the `src/server.ts` gate and the check in `runRouteEffect`. This also fixes finding 4.

TanStack Start now offers `createStart()` in `src/start.ts` with `requestMiddleware`, which runs
before SSR, server routes, and server functions and can push typed context down the chain. If any
per-request runtime wiring is wanted later, that is the idiomatic seam — not a wrapped
`createServerEntry`.

### 7. Three directories and three hops for four endpoints

`routes/api/**` (6-line re-export) → `server-adapters/*.server.ts` → `server-runtime/*.server.ts`.
Ten files, ~450 lines, for liveness, readiness, canary, and telemetry ingress. `routes/api/health/live.ts`
exists solely to call `handleLiveness()`, which exists solely to call `jsonResponse()`.

Collapse to a single `src/server/` module: one `runRoute` helper (span + trace context + exit
mapping) plus handlers written directly in the route files. Keep the split only where a handler has
real logic worth testing without a route (telemetry ingress qualifies; health does not).

### 8. Effect service triplets can collapse

`packages/server/src/database.ts` and `apps/web/src/server-runtime/client-telemetry.server.ts` both
spell out `interface Interface` + `class Service extends Context.Service<Service, Interface>()` +
a separate exported `layer`. Effect v4 supports the shape used throughout the Effect repo itself:

```ts
export class Database extends Context.Service<Database>()("@stu/server/Database", {
  make: Effect.gen(function* () {
    /* … */
  }),
}) {
  static readonly layer = Layer.effect(Database, this.make);
}
```

One declaration, inferred shape, no hand-written interface to keep in sync.

### 9. Dead options in the Database layer

`PgClient.fromPool` never reads `options.applicationName` or `options.types` — it derives both from
`pool.options` (`@effect/sql-pg/src/PgClient.ts:438-447`). The two arguments at
`packages/server/src/database.ts:71-72` read as configuration and do nothing.

Related: `Database.layer` calls `await pool.query("select 1")` at construction. That is what makes a
DB outage fail the whole web runtime including the marketing surface. If the web app should serve
static pages without PostgreSQL, the connection check belongs in readiness, not in layer
construction.

### 10. `Database` leaks its pool to satisfy Better Auth

`Interface` exposes `pool: Pool` purely so `apps/web/src/lib/auth/auth.ts` can build `betterAuth`.
Auth is server-only infrastructure and its tables already live in `packages/server/src/schema/auth.ts`.
Move the `betterAuth(...)` construction into `@stu/server` as an `Auth` service beside its schema,
and drop `pool` from the public interface. `apps/web` then imports one service instead of reaching
through the database into a driver handle.

Note the constraint honestly: Better Auth's `drizzleAdapter` expects a Promise-based Drizzle
instance and cannot consume `EffectPgDatabase`, so the raw-pool/Kysely path is the correct pragmatic
choice, not a shortcut. Its real cost is schema drift between `schema/auth.ts` and Better Auth's
expectations, plus the quoted camelCase column names it forces. Worth a test that boots Better Auth
against the migrated schema, since `db:generate` can no longer catch a mismatch.

### 11. The client telemetry pipeline is a product of its own

- `packages/observability` — 712 lines
- `apps/web/src/lib/observability/browser-client.ts` — 498 lines
- `apps/web/src/server-adapters/telemetry-*.server.ts` + `server-runtime/client-telemetry.server.ts` — ~325 lines
- `apps/mobile/src/observability/` — 812 lines

Two independent outbox implementations (web `browser-client.ts`, mobile `outbox.ts`) over the same
`ClientTelemetryEnvelope`, each with its own bounding, backoff, and drop accounting. This is exactly
the duplication `CLAUDE.md` names as a code smell, and the two halves do not actually interoperate:

- the web ingress requires an `Origin` header matching the request origin
  (`telemetry-policy.server.ts:25-28`); React Native `fetch` sends no `Origin`, so mobile gets `403
same_origin_required`;
- the mobile transport decodes a `{ acceptedRecords }` acknowledgement; the web ingress answers
  `202` with a null body (it happens to fall through to the `body === undefined` branch, but the
  contract was never agreed);
- mobile sends `Authorization: Bearer …`; the ingress has no authenticated relay route, and
  `apps/mobile/src/observability/README.md` records that the mobile channel is therefore disabled.

The parts that clearly earn their keep are small: the server OTLP layer
(`packages/observability/src/server.ts`), the resource/attribute vocabulary, and `flushOtlp`. Keep
those. The bespoke client envelope, both outboxes, the public ingress, the rate limiter, and the
canary duplicate what Sentry and PostHog already do for a product with no users. Recommendation:
delete the client half and re-derive it from one shared implementation when there is real client
traffic and a real authenticated relay. This is the single largest weight reduction available.

If it is kept: the rate limiter in `telemetry-policy.server.ts` is per-process module state and is
ineffective across instances, and `metricForRecord` / `logLevelForSeverity` in
`client-telemetry.server.ts` are switch tables that would be a lookup object.

### 12. Two unused component libraries plus scaffold residue

- `apps/web/src/components/ui/` — 7 shadcn components, 383 lines, imported by nothing.
- `apps/web/src/components/storybook/` — 5 components + 5 stories, ~500 lines, imported only by
  Storybook, and duplicating button/input/slider/dialog from `components/ui`.
- `apps/web/src/lib/auth/header-user.tsx` — rendered nowhere.
- `apps/web/src/routes/index.tsx` returns `null`; the "marketing site" in the package roles does not exist.

Unused dependencies (verified by import scan): `@faker-js/faker`, `@tanstack/match-sorter-utils`,
`@tanstack/react-form`, `@tanstack/react-router-ssr-query`, `@tanstack/react-table`,
`@tanstack/router-plugin`, `@testing-library/react`, `@testing-library/dom`. Build-time packages
(`storybook`, `@storybook/react-vite`, `tailwindcss`, `@tailwindcss/vite`, `nitro`) are in
`dependencies` rather than `devDependencies`, which inflates the Nix `pnpmDeps` closure.

Pick one component library. `@tanstack/react-router-ssr-query` being installed but unused suggests
TanStack Query was intended for the data layer — decide now, since that choice shapes every route
loader that follows.

`apps/web/.cta.json` is create-tanstack-app residue. `apps/web/README.md` is ~80% scaffold text
("Removing Tailwind CSS", "Files prefixed with `demo` can be safely deleted", a tutorial on `Link`);
the Nix/release and Better Auth sections are the only project-specific parts worth keeping.

### 13. No typecheck task

No package defines a `typecheck` script and `just qa` does not run one. `vp lint` with `typeAware`
is not equivalent to a full program check — all five packages currently pass `tsc --noEmit`, but
nothing enforces that. Add `typecheck` per package and to `qa`. (T3 Code does exactly this with
`tsgo --noEmit`.)

### 14. Smaller items

- ~~`apps/web/vite.config.ts` parsed `STUDIENBUCH_WEB_HOST_NAMES` with `JSON.parse` outside the
  schema, so malformed input threw before decoding.~~ Fixed during this audit via
  `Schema.fromJsonString` / `Schema.URLFromString`.
- `apps/web/src/router.tsx` — `getRouter()` is a factory that also installs telemetry subscriptions,
  ~35 lines of side effects. Move them behind one `installRouterTelemetry(router)` call, or delete
  with finding 11.
- `defaultPreloadStaleTime: 0` (scaffold default) makes every intent-preload re-run loaders. Harmless
  today because there are no loaders; will not be later.
- `packages/server/scripts/test.mjs` exists only to set `DOCKER_HOST` for Podman. Put it in the flake
  devShell / `.envrc` and delete the script plus the `"test": "node scripts/test.mjs"` indirection.
- `packages/server/tsconfig.json` omits `"types": ["vite-plus/test"]` that every other package sets,
  and `packages/server` has no `vite.config.ts`, so its tests run unnamed.
- `apps/web/.env.example` documents only `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`; the
  README also requires `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN`.
- `agent-notes/observability-architecture.md` (428 lines) is headed "proposed target architecture,
  not yet implemented" and is implemented. The five agent-notes are completion records, not
  continuity notes; fold the durable decisions into `packages/observability/README` (which does not
  exist) and delete the rest.

## What is genuinely good

Worth saying, because most of the above is subtraction:

- `packages/core` is well-built Effect v4 — schema-first values, `Effect.fn` with named spans,
  errors in the error channel, explicit civil-time modelling with an ADR, namespace projection via
  ordinary ESM. The `CONTEXT.md` domain glossary is unusually disciplined.
- The lint configuration (`vite.config.ts`) is exceptional: all three `@effect/tsgo` presets as
  errors, the anti-slop plugin, and every disabled rule carrying a written justification.
- The Nix release story — `pnpm-workspace-source.nix` per-app source slicing, the workspace source
  check, the descriptor check, the OTLP-collecting release smoke test — is more rigorous than most
  production repos.
- `docs/product/legacy-behavior/` separates disposition from confidence and quarantines legacy bugs
  instead of canonising them. That is the right way to do a rewrite.
- `@effect/vitest` + Testcontainers against the real migration history is the right level for the
  database test.

## Suggested order

1. Finding 1 (Better Auth dates), 2, 3 (migrations in the Release), 4 (health probes) — correctness.
2. Finding 6 (one warm-up) and 7 (collapse the route hops) — this is where the indirection is.
3. Finding 11 — decide on the client telemetry pipeline. Biggest single lever.
4. Finding 12/13 — delete the scaffold, pick one component library, add `typecheck`.
5. Then the vertical slice: `@stu/core` tasks → `@stu/server` table + service → web route.
   Findings 8, 9, and 10 are best done as part of that slice, not before it.
