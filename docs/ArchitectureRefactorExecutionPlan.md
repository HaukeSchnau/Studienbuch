# Architecture Refactor Execution Plan

## Scope, Constraints, And Assumptions

- Scope: monorepo architecture refactor across API, data model, sync/snapshot flow, web/mobile clients, env config, and workspace dependency rules.
- Constraint (non-negotiable): frontend/mobile `type` imports from `@stu/api` are intentional and **not** an architecture problem; this plan does not remove or replace those imports.
- Constraint: execute as PR-sized increments with rollback-safe sequencing.
- Assumption: no package rename is required; refactor happens within existing workspaces under `packages/*`.
- Assumption: standalone API (`@stu/api`) remains the runtime boundary for sync and snapshot endpoints.

## Execution Status (2026-02-23)

- Completed:
- `PR-01: Backend Service Boundary Extraction`
  - Changes landed in:
    - `refactor(api): extract ingest sync service` (`rkk`)
    - `refactor(api): extract topic lookup service` (`wt`)
    - `refactor(api): extract snapshot service` (`xp`)
  - Verification run:
    - `bun --filter @stu/api typecheck` (pass)
    - `bun test packages/api/src/snapshot.test.ts` (pass)
    - `bun run test:sync` (pass)
- `PR-02: Router Boundary Cleanup (Legacy vs Domain)`
  - Changes landed in:
    - `refactor(api): route root through domain router modules` (`ow`)
  - Verification run:
    - `bun --filter @stu/api typecheck` (pass)
    - `bun run test:sync` (pass)
- `PR-03: studentId Contract Alignment`
  - Changes landed in:
    - `refactor(lib): introduce shared StudentId alias` (`tsk`)
    - `refactor(student): align student-scoped repository payloads` (`po`)
    - `refactor(db): type student-scoped payloads with StudentId` (`ot`)
    - `refactor(db): simplify studentId handler wiring` (`tlq`)
  - Verification run:
    - `bun --filter @stu/lib typecheck` (pass)
    - `bun --filter @stu/db typecheck` (pass)
    - `bun --filter @stu/api typecheck` (pass)
    - `bun --filter @stu/student typecheck` (pass)
    - `bun run test:sync` (pass)
- In progress:
- `PR-04: Sync/Snapshot Layering Cleanup`
  - Changes landed in:
    - `refactor(api): extract snapshot request orchestration service` (`ky`)
    - `refactor(api): centralize session user resolution` (`vwy`)
    - `test(api): cover snapshot request service branches` (`vv`)
    - `test(api): add snapshot route transport wiring coverage` (`pr`)
    - `refactor(app-mobile): centralize default snapshot transport wiring` (`ss`)
    - `refactor(app-mobile): extract request header helpers` (`mz`)
    - `refactor(app-mobile): wire sync session context service` (`sr`)
  - Verification run:
    - `bun --filter @stu/api typecheck` (pass)
    - `bun test packages/api/src/services/snapshot-request-service.test.ts` (pass)
    - `bun test packages/api/src/snapshot.test.ts` (pass)
    - `bun --filter @stu/app-mobile typecheck` (pass)
    - `bun test packages/app-mobile/src/utils/snapshot-recovery.test.ts` (pass)
    - `bun test packages/api/src/base.snapshot.test.ts` (pass)
    - `bun run test:sync` (pass)
- `PR-05: Snapshot Mapping Deduplication` (slice 3)
  - Changes landed in:
    - `refactor(student): share snapshot apply helper with app-mobile` (`klu`)
    - `refactor(snapshot): extract shared dedupe helpers` (`sps`)
    - `test(snapshot): share fixtures across api/mobile/lib` (`oo`)
  - Verification run:
    - `bun --filter @stu/lib typecheck` (pass)
    - `bun --filter @stu/api typecheck` (pass)
    - `bun --filter @stu/student typecheck` (pass)
    - `bun --filter @stu/app-mobile typecheck` (pass)
    - `bun test packages/lib/src/snapshot.test.ts` (pass)
    - `bun test packages/api/src/snapshot.test.ts` (pass)
    - `bun test packages/app-mobile/src/utils/snapshot-recovery.test.ts` (pass)
    - `bun run test:sync` (pass)
- Next queued:
- `PR-04`: add reconnect/snapshot fallback integration scenario to `packages/api/src/sync.integration.test.ts`
- `PR-06`: add PG/SQLite schema parity harness tests

## Phase Plan And Parallel Tracks

1. Phase 1 (Foundation): PR-01 to PR-06 in sequence.
2. Phase 2 (Parallel Refactors): after PR-06, run three tracks in parallel:
- Track A (data model dedup): PR-07 -> PR-08.
- Track B (frontend/mobile convergence): PR-09 -> PR-10.
- Track C (platform hygiene): PR-11 -> PR-12.
3. Phase 3 (Cutover): PR-13 after PR-08, PR-10, and PR-12.

Dependency graph:
- `PR-01 -> PR-02 -> PR-03 -> PR-04 -> PR-05`
- `PR-05 -> PR-06`
- `PR-06 -> PR-07 -> PR-08`
- `PR-04 -> PR-09 -> PR-10`
- `PR-01 -> PR-11 -> PR-12`
- `PR-05 + PR-08 + PR-10 + PR-12 -> PR-13`

## PR Backlog

### PR-01: Backend Service Boundary Extraction

- Objective: split API transport wiring from business services so routers and HTTP handlers only orchestrate.
- Exact scope/files:
- `packages/api/src/base.ts`
- `packages/api/src/index.ts`
- `packages/api/src/root.ts`
- `packages/api/src/router/events/ingest.ts`
- `packages/api/src/router/events/send-missing-events.ts`
- `packages/api/src/trpc.ts`
- `packages/api/src/boilerplate.ts`
- New: `packages/api/src/services/sync-service.ts`
- New: `packages/api/src/services/snapshot-service.ts`
- New: `packages/api/src/services/topic-service.ts`
- Dependencies: none.
- Acceptance criteria:
- HTTP layer contains no direct DB query logic except health checks.
- `ingest`, topic resolution, and snapshot resolution are invoked via service interfaces.
- Existing route contracts (`/api/events`, `/api/snapshot`, `/trpc/*`) stay unchanged.
- Risk: medium risk of accidental runtime wiring break in Effect layers.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun run test:sync
bun test packages/api/src/snapshot.test.ts
```

### PR-02: Router Boundary Cleanup (Legacy vs Domain)

- Objective: make router modules match domain boundaries (`auth`, `management`, `schools`, `sync`) and remove mixed legacy composition.
- Exact scope/files:
- `packages/api/src/root.ts`
- `packages/api/src/router/auth/router.ts`
- `packages/api/src/router-legacy/management/router.ts`
- `packages/api/src/router-legacy/management/persons/router.ts`
- `packages/api/src/router-legacy/management/schools/router.ts`
- `packages/api/src/router-legacy/management/users/router.ts`
- `packages/api/src/router-legacy/schools/router.ts`
- `packages/api/src/router-legacy/schools/classes/router.ts`
- `packages/api/src/router-legacy/schools/courses/router.ts`
- `packages/api/src/router-legacy/schools/semesters/router.ts`
- `packages/api/src/router-legacy/schools/years/router.ts`
- New: `packages/api/src/router/management/router.ts`
- New: `packages/api/src/router/schools/router.ts`
- Dependencies: PR-01.
- Acceptance criteria:
- `root.ts` imports only domain routers from `packages/api/src/router/*`.
- Legacy router paths are either removed or left as thin re-export shims with deprecation comments.
- No behavior changes in existing procedures.
- Risk: low to medium; mostly import path churn.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun run test:sync
```

### PR-03: studentId Contract Alignment

- Objective: make `studentId` semantics consistent across events, snapshots, and repository interfaces (`studentId` always maps to the student person UUID).
- Exact scope/files:
- `packages/lib/src/events.ts`
- `packages/lib/src/student.ts`
- New: `packages/lib/src/student-id.ts`
- `packages/lib/src/index.ts`
- `packages/api/src/snapshot.ts`
- `packages/api/src/router/events/send-missing-events.ts`
- `packages/db/src/repositories/student.repo.ts`
- `packages/student/src/repositories/student.repo.ts`
- `packages/db/src/event-handlers/student.ts`
- `packages/student/src/event-handlers/student.ts`
- `packages/api/src/sync.integration.test.ts`
- `packages/db/src/event-handlers/student-scoped-applicators.test.ts`
- `packages/student/src/event-handlers/student-scoped-applicators.test.ts`
- Dependencies: PR-02.
- Acceptance criteria:
- All domain APIs use a single `StudentId` type alias exported from `@stu/lib`.
- No repository API mixes `id`/`userId`/`studentId` ambiguously.
- Sensitive event authorization and topic routing tests pass unchanged or stronger.
- Risk: medium; cross-package type refactor.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun run test:sync
bun test packages/db/src/event-handlers/student-scoped-applicators.test.ts
bun test packages/student/src/event-handlers/student-scoped-applicators.test.ts
```

### PR-04: Sync/Snapshot Layering Cleanup

- Objective: make sync flow explicit as `transport -> context/session -> ingest/apply -> broadcast -> snapshot fallback` with clear layer ownership.
- Exact scope/files:
- `packages/api/src/base.ts`
- `packages/api/src/snapshot.ts`
- `packages/api/src/snapshot-resolver.ts`
- `packages/api/src/router/events/ingest.ts`
- `packages/app-mobile/src/utils/groundswell.tsx`
- `packages/app-mobile/src/utils/sync-lifecycle.ts`
- `packages/app-mobile/src/utils/snapshot-recovery.ts`
- `packages/app-mobile/src/utils/snapshot-recovery.test.ts`
- `packages/api/src/sync.integration.test.ts`
- Dependencies: PR-03.
- Acceptance criteria:
- Snapshot fallback is only triggered from one orchestrator path on mobile.
- API snapshot endpoint has no transport/session branching duplicated in multiple functions.
- Sync integration test coverage still includes reconnect/replay and snapshot-recovery paths.
- Risk: medium; flow orchestration changes.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun run test:sync
bun test packages/app-mobile/src/utils/snapshot-recovery.test.ts
bun test packages/app-mobile/src/utils/sync-lifecycle.test.ts
```

### PR-05: Snapshot Mapping Deduplication

- Objective: remove duplicated snapshot mapping logic by moving entity extraction + write mapping into shared modules.
- Exact scope/files:
- `packages/lib/src/snapshot.ts`
- New: `packages/lib/src/snapshot/entities.ts`
- New: `packages/lib/src/snapshot/mappers.ts`
- `packages/api/src/snapshot.ts`
- `packages/api/src/snapshot-resolver.ts`
- `packages/app-mobile/src/utils/snapshot-recovery.ts`
- New: `packages/student/src/snapshot/apply-snapshot.ts`
- `packages/student/src/index.ts`
- `packages/lib/src/snapshot.test.ts`
- `packages/api/src/snapshot.test.ts`
- `packages/app-mobile/src/utils/snapshot-recovery.test.ts`
- Dependencies: PR-04.
- Acceptance criteria:
- `uniqueBy` utility and entity dedup logic exist in one shared place.
- Mobile snapshot apply uses `@stu/student` snapshot apply helper, not a local duplicate implementation.
- Snapshot tests pass without reduced assertions.
- Risk: medium; regression risk in snapshot hydration.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun test packages/lib/src/snapshot.test.ts
bun test packages/api/src/snapshot.test.ts
bun test packages/app-mobile/src/utils/snapshot-recovery.test.ts
```

### PR-06: PG/SQLite Data-Model Parity Harness

- Objective: create explicit parity checks so duplicated schema intent is verified, then use that harness for dedup work.
- Exact scope/files:
- `packages/db/src/schema/index.ts`
- `packages/student/src/schema/index.ts`
- New: `packages/lib/src/data-model/contracts.ts`
- New: `packages/lib/src/data-model/parity.ts`
- New: `packages/db/src/schema-parity.test.ts`
- New: `packages/student/src/schema-parity.test.ts`
- Dependencies: PR-03.
- Acceptance criteria:
- Parity tests cover shared entities (`schools`, `years`, `classes`, `courses`, `students`, `grades`, `absences`, timetable tables).
- Intended dialect differences (single-student sqlite projection) are documented as explicit allowlist exceptions.
- Risk: low; additive test harness.
- Effort: S.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun test packages/db/src/schema-parity.test.ts
bun test packages/student/src/schema-parity.test.ts
```

### PR-07: Repository Dedup Track A (Org/Core Repos)

- Objective: deduplicate shared behavior across PG and SQLite implementations for school/class/year/course/semester repos.
- Exact scope/files:
- `packages/db/src/repositories/school.repo.ts`
- `packages/db/src/repositories/class.repo.ts`
- `packages/db/src/repositories/year.repo.ts`
- `packages/db/src/repositories/course.repo.ts`
- `packages/db/src/repositories/semester.repo.ts`
- `packages/student/src/repositories/school.repo.ts`
- `packages/student/src/repositories/class.repo.ts`
- `packages/student/src/repositories/year.repo.ts`
- `packages/student/src/repositories/course.repo.ts`
- `packages/student/src/repositories/semester.repo.ts`
- New: `packages/lib/src/repository-logic/org.ts`
- New: `packages/lib/src/repository-logic/course.ts`
- Dependencies: PR-06.
- Acceptance criteria:
- Shared repository behavior (validation, payload shaping, invariant checks) lives in `@stu/lib` and is reused by both adapters.
- DB adapters contain only dialect-specific query details.
- Existing applicator tests for org events remain green.
- Risk: medium; high file touch count.
- Effort: L.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun test packages/db/src/applicators.integration.test.ts
bun test packages/student/src/applicators.integration.test.ts
```

### PR-08: Repository Dedup Track B (Student/Sensitive Repos)

- Objective: deduplicate student/grade/absence/timetable/person/holiday repository logic and align transaction semantics.
- Exact scope/files:
- `packages/db/src/repositories/student.repo.ts`
- `packages/db/src/repositories/grade.repo.ts`
- `packages/db/src/repositories/absence.repo.ts`
- `packages/db/src/repositories/timetable.repo.ts`
- `packages/db/src/repositories/person.repo.ts`
- `packages/db/src/repositories/holiday.repo.ts`
- `packages/student/src/repositories/student.repo.ts`
- `packages/student/src/repositories/grades.repo.ts`
- `packages/student/src/repositories/absences.repo.ts`
- `packages/student/src/repositories/timetable.repo.ts`
- `packages/student/src/repositories/person.repo.ts`
- `packages/student/src/repositories/holiday.repo.ts`
- New: `packages/lib/src/repository-logic/student.ts`
- New: `packages/lib/src/repository-logic/grades.ts`
- New: `packages/lib/src/repository-logic/absences.ts`
- Dependencies: PR-07.
- Acceptance criteria:
- Shared student-sensitive business rules are centralized.
- Repository behavior differences are intentional and documented (e.g., sqlite single-user projection constraints).
- Sensitive-event integration tests remain green.
- Risk: high; touches core write paths.
- Effort: L.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun run test:sync
bun test packages/db/src/applicators.live.integration.test.ts
bun test packages/app-mobile/src/utils/snapshot-recovery.test.ts
```

### PR-09: Frontend/Mobile TRPC + Auth/Session Abstraction

- Objective: converge Next.js and mobile client wiring around shared TRPC headers/base config and shared session contract.
- Exact scope/files:
- `packages/nextjs/src/infrastructure/trpc/react.tsx`
- `packages/nextjs/src/infrastructure/trpc/server.ts`
- `packages/nextjs/src/infrastructure/trpc/query-client.ts`
- `packages/nextjs/src/features/auth/isLoggedIn.ts`
- `packages/nextjs/src/features/auth/serverActions/setSessionToken.ts`
- `packages/nextjs/src/features/auth/serverActions/logout.ts`
- `packages/app-mobile/src/utils/api.tsx`
- `packages/app-mobile/src/utils/auth.ts`
- `packages/lib-server/src/auth/index.ts`
- `packages/lib-server/src/auth/session.ts`
- New: `packages/lib/src/client/session-contract.ts`
- New: `packages/lib/src/client/trpc-client-config.ts`
- Dependencies: PR-04.
- Acceptance criteria:
- Both clients construct TRPC headers via a shared helper.
- Session shape is consistent (`token`, `userId`) across web/mobile adapters.
- No changes to intentional frontend/mobile `type` imports from `@stu/api`.
- Risk: medium; authentication regression risk.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun x tsc --noEmit -p packages/nextjs/tsconfig.json
bun --filter @stu/app-mobile typecheck
```

### PR-10: Frontend/Mobile Timetable Convergence

- Objective: converge timetable domain shaping and remove dead/placeholder web timetable paths.
- Exact scope/files:
- `packages/lib/src/schedule/timetable.ts`
- New: `packages/lib/src/schedule/timetable-projection.ts`
- `packages/nextjs/src/features/timetable/TimetableManager.tsx`
- `packages/nextjs/src/features/timetable/TimetableView.tsx`
- `packages/app-mobile/src/features/agenda/queries/week.ts`
- `packages/app-mobile/src/features/schedule/schedule.page.tsx`
- `packages/admin-panel/src/routes/timetable.tsx`
- Dependencies: PR-09.
- Acceptance criteria:
- All three clients consume a shared timetable projection utility.
- Next.js timetable no longer returns placeholder empty data.
- Query keys and timetable projection semantics are consistent across web/mobile.
- Risk: medium; UI behavior changes.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun --filter @stu/app-mobile typecheck
bun x tsc --noEmit -p packages/nextjs/tsconfig.json
```

### PR-11: Env Schema Centralization

- Objective: consolidate env key definitions and validation schema composition to eliminate drift between packages.
- Exact scope/files:
- `packages/api/env.ts`
- `packages/db/env.ts`
- `packages/console/src/env.ts`
- `packages/nextjs/src/env.ts`
- `packages/external-api/env.ts`
- `packages/legacy-import/env.ts`
- New: `packages/lib-server/src/env/schema.ts`
- New: `packages/lib-server/src/env/keys.ts`
- `turbo.json`
- `.env.example`
- Dependencies: PR-01.
- Acceptance criteria:
- Shared env keys are defined once and imported by package env files.
- `turbo.json` `globalEnv` matches centralized key list.
- Missing/invalid required env values fail fast at startup/typecheck in each package.
- Risk: medium; startup failures if key mapping is wrong.
- Effort: M.
- Verification commands:
```bash
bun run lint
bun run typecheck
bun x tsc --noEmit -p packages/nextjs/tsconfig.json
bun --filter @stu/api typecheck
bun --filter @stu/db typecheck
```

### PR-12: Workspace Dependency Hygiene Enforcement

- Objective: enforce stable workspace dependency boundaries and prevent accidental cross-package coupling.
- Exact scope/files:
- `package.json`
- `tooling/visualize-deps.ts`
- `workspace-deps.png` (regenerated)
- `packages/api/package.json`
- `packages/db/package.json`
- `packages/student/package.json`
- `packages/app-mobile/package.json`
- `packages/nextjs/package.json`
- `packages/admin-panel/package.json`
- `packages/console/package.json`
- Dependencies: PR-11.
- Acceptance criteria:
- `bun run lint:ws` passes.
- Workspace ranges are normalized and intentional (`workspace:*` vs `workspace:^`) with a documented rule.
- Dependency graph output is regenerated and reviewed for unexpected edges.
- Risk: low; mostly metadata/config churn.
- Effort: S.
- Verification commands:
```bash
bun run lint:ws
nix run nixpkgs#graphviz --command bun tooling/visualize-deps.ts
bun run lint
```

### PR-13: Rollout Safeguards, Cutover, And Cleanup

- Objective: complete migration with guarded rollout, fallback paths, and removal of temporary compatibility code.
- Exact scope/files:
- `packages/api/src/sync.integration.test.ts`
- `packages/api/src/snapshot.test.ts`
- `packages/app-mobile/src/utils/snapshot-recovery.test.ts`
- `packages/app-mobile/src/utils/sync-lifecycle.test.ts`
- `packages/app-mobile/maestro/flows/sync-lifecycle-resume.yml`
- `packages/app-mobile/maestro/flows/sync-lifecycle-replay.yml`
- `packages/app-mobile/maestro/flows/sync-lifecycle-network-reconnect.yml`
- `packages/app-mobile/maestro/flows/sync-lifecycle-sensitive-auth-reconnect.yml`
- `docs/MigrationProgress.md`
- Dependencies: PR-05, PR-08, PR-10, PR-12.
- Acceptance criteria:
- Cutover checklist executed with canary -> broad rollout -> cleanup.
- Snapshot/sync fallback metrics and logs are available for incident triage.
- Compatibility shims introduced earlier are removed after successful canary window.
- Risk: medium; production rollout coordination.
- Effort: M.
- Verification commands:
```bash
bun run ci
bun run test:sync
bun test packages/app-mobile/src/utils/snapshot-recovery.test.ts
bun test packages/app-mobile/src/utils/sync-lifecycle.test.ts
bun run test:maestro:mobile
```

## Rollout Strategy

1. Pre-cutover (after PR-12): run full CI plus targeted sync/snapshot tests on current mainline data.
2. Canary rollout: enable refactored paths for a limited internal cohort (mobile + API) while keeping compatibility adapters active.
3. Observe for one release window:
- snapshot fallback error rate,
- sync replay consistency,
- auth/session failure rate,
- timetable query parity across clients.
4. Broad rollout: promote refactored paths to all users.
5. Cleanup: remove compatibility shims in PR-13 only after canary/broad windows are stable.

## Migration Safeguards

- Keep wire contracts stable (`/api/events`, `/api/snapshot`, `/api/trpc`) during PR-01..PR-12.
- Add parity tests before deduping code paths (PR-06 first, then PR-07/PR-08).
- Preserve dual-path adapters for at least one rollout window where behavior is high risk (auth/session, snapshot apply).
- Block merges on failing sync integration tests and schema parity tests.
- Require explicit rollback notes in each PR description for changed runtime boundaries.

## Definition Of Done

- Backend boundaries are explicit: transport/routing does not contain domain logic.
- Sync/snapshot layering is single-path and test-covered.
- Snapshot mapping logic is centralized and reused.
- `studentId` contract is consistent and typed across all packages.
- PG/SQLite schema + repository duplication is reduced with shared logic and parity checks.
- Frontend/mobile share TRPC/session abstractions and timetable projection semantics.
- Env schema is centralized and drift-free.
- Workspace dependency rules are enforced and graph-reviewed.
- CI and targeted sync/snapshot tests pass on mainline.
