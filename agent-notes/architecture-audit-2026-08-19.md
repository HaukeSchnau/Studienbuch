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
row, decode/encode at the DB edge, transaction boundaries, sync envelope — is still unexercised.

Building infrastructure ahead of product is a deliberate strategy here, and the table above is not
an argument against it. But it _is_ an argument for which infrastructure comes next: the
core↔persistence seam is the one most likely to force rework once it carries load, and it is the
only major seam with no implementation pinning it down. One vertical slice (tasks is the smallest)
from `@stu/core` aggregate → Drizzle table → Effect service in `@stu/server` → TanStack server
function → web route would settle the encode/decode boundary, the transaction shape, and the
repository idiom while they are still cheap to change.

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

Fix: make both runtime-configured rather than build-time inlined, and lazily imported the way
`sentry-client.ts` already is, so the release action can supply the DSN/key from
`project-context` like it does for `BETTER_AUTH_SECRET`. Threading `VITE_*` through the Nix build
as build-time inputs also works but rebuilds the application whenever a key rotates.

The 557 KB `index-*.js` is a consequence, not a separate finding: `posthog-js` is statically
imported at module scope for a call that is eliminated. A lazy import fixes both.

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

### 7. The route layering is right; it is not applied consistently

`routes/api/**` (thin binding) → `server-adapters/*.server.ts` (handler) → `server-runtime/*.server.ts`
(shared plumbing) is the correct shape, and the per-endpoint file count stops looking like ceremony
somewhere around the tenth endpoint. Keep it.

What does not scale is that the layer has two different shapes for the same job. `telemetry-ingress`
exports a `makeTelemetryIngressHandler({ policy, run })` factory with injectable seams plus a
default instance; `health.server.ts` exports plain module functions that reach for the module-level
`runRouteEffect` and `applicationRuntimeState` directly, so it can only be tested against the real
process-wide runtime — which is why `health.server.test.ts` asserts on global state and gets finding
4 wrong. Pick the factory shape for every adapter and derive the default instance mechanically.

Also fold `http-response.server.ts`'s hand-rolled `JsonValue` recursion away; `Response.json`
accepts `unknown`, and the type buys nothing that the handler's own return type does not.

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

The `await pool.query("select 1")` at construction is fine as a deliberate fail-fast: a service that
will be database-backed everywhere is better off refusing to start than serving a degraded surface.
The gap is only that nothing re-checks afterwards — see finding 4.

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

### 11. One telemetry protocol, two incompatible implementations

Decision on record: the client telemetry channel is deliberate and stays. This finding is therefore
not about its size — it is that the channel does not currently work end to end, and that the two
client halves are diverging copies rather than one implementation.

- `packages/observability` — 712 lines
- `apps/web/src/lib/observability/browser-client.ts` — 498 lines
- `apps/web/src/server-adapters/telemetry-*.server.ts` + `server-runtime/client-telemetry.server.ts` — ~325 lines
- `apps/mobile/src/observability/` — 812 lines

The web and mobile clients cannot talk to the ingress they were written against:

- the ingress requires an `Origin` header matching the request origin
  (`telemetry-policy.server.ts:25-28`); React Native `fetch` sends no `Origin`, so mobile receives
  `403 same_origin_required`;
- the mobile transport decodes a `{ acceptedRecords }` acknowledgement; the ingress answers `202`
  with a null body. Mobile survives only because it falls through to its `body === undefined`
  branch — the contract was never actually agreed;
- mobile sends `Authorization: Bearer …`, but there is no authenticated relay route, which is why
  `apps/mobile/src/observability/README.md` records the whole mobile channel as disabled.

`browser-client.ts` (498 lines) and `outbox.ts` (354 lines) independently implement the same
concern — a bounded, backoff-driven, drop-accounting outbox over one `ClientTelemetryEnvelope` —
with different eviction rules, different backoff curves, and different flush results. This is the
duplication `CLAUDE.md` names as a code smell, and it gets _worse_ with scale, not better: every
future record type, priority rule, or retry change has to be made twice and verified twice.

Building this right means:

1. **One outbox in `@stu/observability`** with platform ports (`storage`, `fetch`, `clock`,
   `random`, timers). The web supplies in-memory + `sendBeacon`; mobile supplies the Expo document
   store. Both existing test suites become one suite against the shared implementation.
2. **One wire contract.** Decide whether the ingress acknowledges with `{ acceptedRecords }` or with
   a bare `202`, put it in the shared package next to `ClientTelemetryEnvelope`, and make both the
   ingress and the transports decode it from that one definition.
3. **Two admission paths, one handler.** Same-origin browser traffic keeps the `Origin` check;
   mobile needs a session-authenticated route. Model this as an explicit `TelemetryAdmission` seam
   rather than a single hard-coded origin policy, so `Origin` is one strategy and bearer-token
   verification is another.
4. **A rate limiter that survives horizontal scaling.** `telemetry-policy.server.ts` holds its
   window in per-process module state. That is not a limiter once there is more than one instance;
   it needs to be per-principal and backed by shared state, or dropped in favour of ingress-level
   limiting.
5. **An end-to-end test that a client envelope reaches the OTLP exporter.** The release smoke check
   already stands up an OTLP collector and asserts `/v1/{logs,metrics,traces}` — extend it to post
   a real envelope through the ingress. That single test would have caught all three interop gaps.

Minor: `metricForRecord` and `logLevelForSeverity` in `client-telemetry.server.ts` are switch
statements over closed unions that would read better as lookup objects, and the metric allowlist in
`metricForRecord` has to be kept in sync by hand with the names the clients emit — worth deriving
both from one table.

### 12. Two overlapping component libraries

`apps/web/src/components/ui/` (7 shadcn components, 383 lines) and
`apps/web/src/components/storybook/` (5 components + 5 stories, ~500 lines) both define button,
input, slider, and dialog. Neither is imported by a route. Two component vocabularies is the one
item here that compounds with scale rather than being absorbed by it: the first real screen has to
pick, and whichever loses becomes a second dialect that keeps attracting edits.

Decide which is canonical — `components/ui` (shadcn, regenerable via `shadcn add`, matching
`components.json`) or the hand-written `components/storybook` set — and point the stories at it.

Lower-priority residue, not urgent: `lib/auth/header-user.tsx` is rendered nowhere; `.cta.json` is
create-tanstack-app output; `apps/web/README.md` is ~80% scaffold text ("Removing Tailwind CSS",
"Files prefixed with `demo` can be safely deleted", a tutorial on `Link`) around genuinely useful
Nix/release and Better Auth sections.

Currently-unimported dependencies, listed as inventory rather than as a deletion list, since several
are plainly forward commitments: `@tanstack/react-form`, `@tanstack/react-table`,
`@tanstack/react-router-ssr-query`, `@tanstack/match-sorter-utils`, `@testing-library/react`,
`@testing-library/dom`, `@faker-js/faker`. Worth an actual decision on
`@tanstack/react-router-ssr-query` specifically — whether TanStack Query backs the data layer
shapes every route loader that follows, and that is cheaper to settle before the first loader than
after the twentieth.

Build-time packages (`storybook`, `@storybook/react-vite`, `tailwindcss`, `@tailwindcss/vite`,
`nitro`) sit in `dependencies` rather than `devDependencies`, which inflates the Nix `pnpmDeps`
closure that the release build fetches.

### 13. ~~No typecheck task~~ — withdrawn

Wrong when written. `vp lint` runs with `options.typeCheck: true` and reports TypeScript
diagnostics directly: a deliberate `const x: number = "…"` probe produced
`error typescript(TS2322)` and exit code 1. Full type checking is enforced by `just lint` and
therefore by `just qa`. No separate `typecheck` script is needed.

### 14. Smaller items

- ~~`apps/web/vite.config.ts` parsed `STUDIENBUCH_WEB_HOST_NAMES` with `JSON.parse` outside the
  schema, so malformed input threw before decoding.~~ Fixed during this audit via
  `Schema.fromJsonString` / `Schema.URLFromString`.
- `apps/web/src/router.tsx` — `getRouter()` is a factory that also installs ~35 lines of telemetry
  subscriptions inline. Move them behind one `installRouterTelemetry(router)` in the observability
  module; the router factory should not be where navigation-timing policy lives.
- `defaultPreloadStaleTime: 0` (scaffold default) makes every intent-preload re-run loaders. Harmless
  today because there are no loaders; will not be later.
- `packages/server/scripts/test.mjs` exists only to set `DOCKER_HOST` for Podman. Put it in the flake
  devShell / `.envrc` and delete the script plus the `"test": "node scripts/test.mjs"` indirection.
- `packages/server/tsconfig.json` omits `"types": ["vite-plus/test"]` that every other package sets,
  and `packages/server` has no `vite.config.ts`, so its tests run unnamed.
- `apps/web/.env.example` documents only `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`; the
  README also requires `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_SENTRY_DSN`.
- `agent-notes/observability-architecture.md` (428 lines) is headed "proposed target architecture,
  not yet implemented" and is implemented. The design content is worth keeping; the status header is
  actively misleading. `packages/observability` has no README, so the one place a reader looks for
  the channel's contract is the place that says it does not exist yet.

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

1. Findings 1 (Better Auth dates), 2 (OID 1231), 3 (migrations in the Release), 4 (health probes),
   9 (dead `fromPool` options) — correctness and pure facts, small and independent.
2. Finding 6 — collapse three warm-ups to one. Finishes the fix for 4.
3. Finding 11 — make the telemetry channel work end to end: one shared outbox, one wire contract,
   an authenticated admission path for mobile, and the release-smoke assertion that proves it.
   Largest and most valuable piece of work on this list.
4. Finding 5 — runtime-configure and lazily import Sentry/PostHog so the release actually reports.
5. Finding 12 — pick the canonical component library; settle the TanStack Query question.
6. The vertical slice: `@stu/core` tasks → `@stu/server` table + service → web route.
   Findings 7, 8, and 10 are best done as part of that slice, where the second and third adapters
   show whether the shape generalizes.

## Revision history

**2026-08-19, after review.** Two corrections and a premise change:

- Finding 13 withdrawn — `vp lint` does enforce full type checking (verified with a probe).
- The client telemetry pipeline is a deliberate keeper. Finding 11 previously recommended deleting
  the client half; that recommendation is retracted. What survives, and strengthens, is that the
  channel does not work end to end and exists as two diverging implementations.
- Findings 7, 9, 12, and the opening framing softened where they rested on "this is premature"
  rather than on the code. Building infrastructure ahead of product is the stated strategy; an
  audit should not keep re-litigating it. Everything argued from correctness, duplication, or a
  broken contract stands unchanged.
