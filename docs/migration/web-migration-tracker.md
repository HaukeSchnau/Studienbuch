# Web Migration Tracker (`@stu/nextjs` -> `@stu/web`)

## Decision Snapshot

- Migration target: web surface runs from `@stu/web` (`packages/web`).
- Cutover mode: big-bang cutover (single switch), no long-lived dual-routing phase.
- Runtime slot: Docker service name remains `nextjs` and image tag remains `studienbuch-nextjs:nix`.
- Admin surface: `@stu/admin-panel` remains a separate package/service (`admin-panel`).
- API routing: web route surface no longer exposes legacy `/api/trpc`; tRPC transport is served by the standalone API (`/trpc/*` on `@stu/api`).

## Acceptance Checklist (WS-00..WS-09)

| WS | Scope | Acceptance Criteria | Status | Evidence |
| --- | --- | --- | --- | --- |
| WS-00 | Control-plane alignment | Decisions and owners documented for cutover and rollback | PASS | This tracker + `web-cutover-runbook.md` |
| WS-01 | Package cutover | `@stu/web` is the web runtime package; `packages/nextjs` is not the active runtime target | PASS | `packages/web/package.json`, `docs/packages/README.md` |
| WS-02 | Build artifact continuity | `oci-nextjs-archive` builds from `packages/web` | PASS | `nix/flake-parts/studienbuch/oci/artifacts.nix` |
| WS-03 | Service slot continuity | Compose service slot name `nextjs` retained for rollout stability | PASS | `docker-compose.yml` (`nextjs` service) |
| WS-04 | Route migration | Web UI routes migrated to `packages/web/src/routes/*` (TanStack Start route surface) | PASS | `packages/web/src/routes/*`, `packages/web/src/routeTree.gen.ts` |
| WS-05 | Legacy API route decommission | Legacy `/api/trpc` removed from active web route surface | PASS | No `/api/trpc` in `packages/web/src/routes`; legacy code isolated under `src/legacy-next-app` |
| WS-06 | Admin separation | Admin panel remains isolated (`@stu/admin-panel`, `admin-panel` service) | PASS | `docker-compose.yml`, `docs/architecture/runtime-topology.md` |
| WS-07 | Command verification | Cutover verification commands tracked with pass/fail + blockers | PASS | Verification matrix below |
| WS-08 | Rollback readiness | Documented rollback to prior `packages/web` image revision in `nextjs` slot | PASS | `web-cutover-runbook.md` rollback section |
| WS-09 | Post-cutover cleanup | Cleanup items and ownership defined | PASS | `web-cutover-runbook.md` cleanup + ownership sections |

## Route Migration Map (Legacy Next App -> `@stu/web` Routes)

| Legacy path family (`legacy-next-app`) | Active path | `@stu/web` route file family |
| --- | --- | --- |
| `/(public)` (`/`, `/impressum`, `/datenschutz`, `/roadmap`) | Same public paths | `_public.*.tsx` |
| `/login` | `/login` | `login.tsx` |
| `/admin` | `/admin` | `admin*.tsx` |
| `/admin/users*` | `/admin/users*` | `admin.users*.tsx` |
| `/admin/people*` | `/admin/people*` | `admin.people*.tsx` |
| `/admin/schools*` | `/admin/schools*` | `admin.schools*.tsx` |
| `/admin/schools/:school/years/:startYear/{classes,courses,schedules}` | Same paths | `admin.schools.$school.years.$startYear.{classes,courses,schedules}.tsx` |
| `/admin/schools/:school/{theme,substitutions}` | Same paths | `admin.schools.$school.{theme,substitutions}.tsx` |

Note: legacy API handlers under `packages/web/src/legacy-next-app/app/api/*` are not part of the active `@stu/web` route surface and are tracked for removal in cleanup.

## Command Verification Matrix (Cutover)

| Command | Result | Notes |
| --- | --- | --- |
| `bun --filter @stu/web build` | PASS | Web artifact build succeeds for cutover image generation |
| `bun --filter @stu/web typecheck` | PASS | Web package type surface valid |
| `bun --filter @stu/admin-panel build` | PASS | Admin panel remains independently deployable |
| `bun run test` | PASS | Full test suite passes, including new `@stu/web` auth/permission tests |
| `bun run test:sync` | PASS | Sync transport contract unchanged during web cutover |
| `just live-health-web` | PASS | `nextjs` and `admin-panel` health checks return success |
| `nix build --no-link .#packages.aarch64-linux.oci-nextjs-archive` | PASS | Next slot image artifact builds from `@stu/web` |
| `nix build --no-link .#packages.aarch64-linux.oci-admin-panel-archive` | PASS | Admin panel image artifact builds unchanged |
| `bun run lint` | FAIL (known unrelated blocker) | Pre-existing `@stu/app-mobile` type-aware lint errors in `packages/app-mobile/src/app/setup/name-and-year.tsx` |
| `bun run typecheck` | FAIL (known unrelated blocker) | Pre-existing `@stu/app-mobile` TS errors in `packages/app-mobile/src/app/setup/name-and-year.tsx` |
