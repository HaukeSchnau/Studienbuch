# Web Cutover Runbook (`@stu/nextjs` -> `@stu/web`)

## Scope

Operational control-plane runbook for the completed big-bang cutover from legacy Next.js web runtime to `@stu/web`, while keeping runtime slot names stable.

## Implemented Runtime Decisions

- Active web package: `@stu/web` (`packages/web`).
- Deployment slot name retained: `nextjs` service + `studienbuch-nextjs:nix` image name.
- `@stu/admin-panel` remains separate and is deployed as `admin-panel`.
- API ownership remains with `@stu/api`; web no longer owns `/api/trpc` route surface.

## Cutover Procedure (Reference)

1. Build and load OCI artifacts (`api`, `nextjs`, `admin-panel`, supporting services).
2. Deploy with existing compose topology (`nextjs` slot retained):
   - `just live-up` (or `just live-up-dev` in local/dev profile).
3. Validate service health:
   - `just live-health`
   - `just live-health-web`
4. Validate package-level web/admin checks and sync contract checks (see matrix).
5. Mark WS-00..WS-09 acceptance as complete in `web-migration-tracker.md`.

## Verification Matrix

| Command | Expected | Result | Gate |
| --- | --- | --- | --- |
| `bun --filter @stu/web build` | Web build succeeds | PASS | Required |
| `bun --filter @stu/web typecheck` | Web typecheck succeeds | PASS | Required |
| `bun --filter @stu/admin-panel build` | Admin panel build succeeds | PASS | Required |
| `just live-health-web` | `nextjs` + `admin-panel` healthy | PASS | Required |
| `bun run test:sync` | Sync route contract unchanged | PASS | Required |
| `bun --filter @stu/app-mobile lint` | Mobile lint may fail | FAIL (known unrelated blocker) | Non-blocking |
| `bun --filter @stu/app-mobile typecheck` | Mobile typecheck may fail | FAIL (known unrelated blocker) | Non-blocking |

Known unrelated blockers:
- `@stu/app-mobile` lint/typecheck failures are tracked outside this web cutover and do not block WS-00..WS-09 acceptance.

## Rollback Procedure

Trigger rollback when web health checks fail after deploy or critical admin/public routes regress.

1. Select last known good revision that produced a stable `nextjs` image.
2. Build or retrieve the previous `packages/web` OCI archive (same image name):
   - `nix build .#packages.aarch64-linux.oci-nextjs-archive`
3. Load the previous archive into Docker (via existing loader path):
   - `just oci-load`
4. Redeploy only the `nextjs` slot with the previous image:
   - `./tooling/with-env.sh docker compose --profile live -f docker-compose.yml up -d --no-build nextjs`
5. Re-run health checks:
   - `just live-health-web`
6. If still unhealthy, revert full stack to previous revision (`api` + `nextjs` + `admin-panel`) and re-run `just live-health-all`.

Rollback note:
- Slot name stays `nextjs`; rollback is image/revision swap, not service renaming.

## Post-Cutover Cleanup

- Remove remaining `packages/web/src/legacy-next-app/app/api/*` compatibility handlers after confirming no dependency.
- Remove any stale references to `@stu/nextjs` from docs/scripts if discovered.
- Keep runtime docs aligned (`docs/architecture/runtime-topology.md`, `docs/packages/README.md`).
- Track and resolve unrelated `@stu/app-mobile` lint/typecheck blockers separately.

## Ownership

| Area | Owner |
| --- | --- |
| WS-00..WS-05 (web package/route/API surface) | Web platform owner |
| WS-06 (admin-panel separation) | Admin panel owner |
| WS-07 verification execution | Release owner |
| WS-08 rollback execution | On-call / release owner |
| WS-09 cleanup closure | Web platform owner + tech lead |

