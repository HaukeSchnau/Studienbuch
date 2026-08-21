# Repository best-practices audit — 2026-08-21

Scope: whole repository, weighted toward `packages/core`, TypeScript strictness, lint
configuration, and cross-package organization. This is the follow-up to
`architecture-audit-2026-08-19.md`, which was weighted toward `packages/server` and `apps/web` and
explicitly excluded `apps/mobile`. Findings already recorded and fixed there are not repeated.

Baseline verified at `29cb3e071`:

- `vp fmt --check` clean (453 files).
- `tsc --noEmit` clean for all eight tsconfig projects.
- `vp lint` clean, and it does enforce TypeScript diagnostics (re-verified with a probe).
- Tests: core 90, web 28, observability 21, mobile 19, console 4 — all green when run per package.
  `packages/server`'s integration test needs a container runtime.

Nothing below is a build break. One item is a correctness bug with a reproduction.

## The one correctness bug

### 1. A withdrawn absence is silently resurrected — high

`Attendance.acknowledge` and `Attendance.decideMissedLesson` rebuild `AbsenceCase` field by field
instead of spreading the input, and neither carries `withdrawal` across:

- `attendance/acknowledge.ts:127-136`
- `attendance/decide-missed-lesson.ts:170-186`

Both are reachable. `withdrawAbsence` only requires that no missed lesson has been decided; it does
not require the case to be unacknowledged, and it does not stop later lesson decisions. So both of
these erase the tombstone:

1. `acknowledge` → `withdrawAbsence` → `decideMissedLesson`
2. `withdrawAbsence` → `acknowledge`

After either, `isAbsenceWithdrawn` returns `false` and `status` reports a live case. This is exactly
the failure the withdrawal design comment in `organization/acknowledgement.ts` exists to prevent —
"a peer that has not yet seen a hard delete would resurrect the row on the next sync" — except the
aggregate resurrects it locally, without any sync involved.

Verified with a temporary probe test against `packages/core`; both scenarios fail on
`assert.isTrue(Attendance.isAbsenceWithdrawn(...))`. The existing suite does not cover it:
`attendance.test.ts` only asserts withdrawal survives a _second_ withdrawal attempt.

The narrow fix is to spread the input in both functions the way `withdraw.ts:69` already does. The
real fix is finding 4 — nothing should be hand-rebuilding an aggregate.

### 2. A failed first storage read permanently disables the telemetry outbox — medium

`packages/observability/src/client/outbox.ts:189-197`. The constructor assigns
`#ready = this.#load()` and never attaches a rejection handler. `#load` awaits
`storage.read()`, which on mobile is a filesystem call. If it rejects:

- `#ready` is a rejected promise, and `#serial` awaits it on _every_ call, so `enqueue`, `flush`
  and `stats` reject forever rather than degrading to an empty queue;
- until the first `#serial` call, the rejection is unhandled.

`decodeSnapshot` is already carefully defensive about corrupt contents; the read itself is not.
Wrapping the `read()` in a `catch` that falls back to `emptySnapshot()` restores the intended
"lose the queue, keep the client" behaviour.

### 3. `Assessment.AlreadyWithdrawn` names a target it cannot produce

`assessment/written-assessment.ts:76-79` declares
`target: Schema.Literals(["WrittenAssessment", "AbsenceCase"])`. Attendance has its own
`Attendance.AlreadyWithdrawn` (`attendance/withdraw.ts:9`) and never constructs this one, so
`"AbsenceCase"` is an inhabitable-but-unreachable case in a domain error's payload. It is a symptom
of finding 4, not an independent problem.

## Domain modelling — the largest lever

`packages/core` is the best code in the repository and the previous audit was right to say so. What
follows is not about its quality; it is that one concept has been written down three times, and the
copies have already drifted in ways that produced finding 1.

### 4. One confirmation lifecycle, three encodings

Written assessments, standing revisions and absence cases all implement the same aggregate
protocol: check the expected revision, refuse if the step already happened, authorize, advance the
revision, attach evidence. Today that is spelled out independently in five files.

The concurrency check alone exists four times, character-for-character apart from its type:

| File                                    | Error tag                                        |
| --------------------------------------- | ------------------------------------------------ |
| `assessment/written-assessment.ts:98`   | `Assessment.ConcurrentWrittenAssessmentRevision` |
| `assessment/course-standing.ts:169`     | `Assessment.ConcurrentStandingRevision`          |
| `attendance/acknowledge.ts:42`          | `Attendance.ConcurrentRevision`                  |
| `attendance/decide-missed-lesson.ts:61` | `Attendance.ConcurrentRevision`                  |
| `tasks/school-task.ts:104` (inlined)    | `Tasks.ConcurrentRevision`                       |

Four names, three payload shapes (`Tasks` adds `taskId`; the others do not) for one condition. The
`29cb3e071` predecessor commit is literally titled "give every failure one naming rule", and this is
the place the rule has not landed.

Withdrawal is written twice — `withdrawWritten` and `withdrawAbsence` are the same seven steps with
`WithdrawalLockedByAttestation` vs `WithdrawalLockedByDecision` as the guard. Learner
acknowledgement is written twice and _differently_:

- `assessment/learner-acknowledgement.ts` raises `Assessment.AcknowledgementActor` with reasons
  `AdultMustAcknowledgeSelf | GuardianRequired | StudentIdentityMismatch`, plus a separate
  `Assessment.LegalStatusUnknown` carrying `studentId` and `on`.
- `attendance/acknowledge.ts` raises `Attendance.AcknowledgementActor` with reasons
  `AdultMustAcknowledgeSelf | GuardianRequired | LegalStatusUnknown` — folding the legal-status case
  into the actor error and losing the date — plus a separate `Attendance.StudentIdentity`.

Same decision, opposite decompositions. A UI that wants to say "we need a parent to confirm this"
has to learn both.

Compounding this, `learner-acknowledgement.ts` lives under `assessment/` but the rule it encodes —
who may acknowledge on behalf of a student, given legal status — belongs to `organization/`. Its
home is why attendance re-implemented rather than imported it.

**Suggested shape.** A `foundation/` (or new `confirmation/`) module owning:

- `Concurrent` — one revision-mismatch error carrying `expected`, `actual`, and an aggregate tag.
- `Attestation` / `Acknowledgement` / `Withdrawal` transitions parameterized over the aggregate.
- `authorizeLearnerAcknowledgement` moved to `organization/`, with one error decomposition.

Then `AlreadyTeacherAttested`/`AlreadyLearnerAcknowledged`'s `target` literal becomes the single
place the aggregate list lives, and finding 3 becomes impossible to write.

### 5. Aggregates are updated by hand, five different ways

There is no `revise` helper, so every transition improvises:

- spread + suppression: eight `// oxlint-disable-next-line typescript/no-misused-spread` sites
  across `written-assessment.ts`, `course-standing.ts`, `withdraw.ts`, `school-task.ts`;
- full field-by-field rebuild: `attendance/acknowledge.ts`, `attendance/decide-missed-lesson.ts`
  — this is what caused finding 1;
- combinatorial branching on optional fields: `schedule/materialize.ts:88-103` has four
  `LessonOccurrence.make` calls to cover two optional keys. A third optional field makes it eight.

One helper — `revise(schema, aggregate, changes)` that advances the revision and drops `undefined`
values before `make` — replaces all three patterns, deletes the eight suppressions, and makes
"forgot to carry a field" unrepresentable.

### 6. Two competing idioms for cross-entity invariants

`organization/directory.ts` is the good one: `validateSchoolDirectory` returns
`InvalidSchoolDirectory` with `entity`, `entityId` and `reason`, so a caller can say what is wrong
and point at it.

The other one is `Schema.makeFilter` returning a bare boolean:

- `organization/authority.ts:34-89` — a 55-line filter checking uniqueness across five
  collections, membership-role coherence, guardian relationship validity and teaching-assignment
  scope, all collapsing into `"a coherent, uniquely identified authority snapshot"`.
- `attendance/absence-case.ts:53-90` — six distinct invariants, one message.
- `assessment/course-standing.ts:57-84`, `assessment/written-assessment.ts:37-50`,
  `organization/catalog.ts:26-33`, `schedule/academic-calendar.ts:24-33`.

`makeFilter` is right for a _value_ invariant (`start <= end`, non-blank text). For a referential
invariant over a graph, it destroys exactly the information the caller needs. `AuthoritySnapshot` is
the one that will hurt: it is built by the application boundary from database rows, and when it
fails there is no way to tell which row.

`schedule/academic-calendar.ts:26-32` also re-implements the non-overlap check that
`validateAcademicTerms` already performs with a proper `OverlappingAcademicTerms` error naming both
terms — same rule, worse diagnostics, second copy.

### 7. Namespace ceremony that adds nothing

`export declare namespace f { interface Input }` is a real Effect-ecosystem idiom and it earns its
keep where the input is genuinely per-function. It does not in `tasks/school-task.ts`, where
`complete.Input`, `reopen.Input` and `cancel.Input` are each `export type Input = TransitionInput`
— three declarations that rename one type. `attestStanding.Input` is
`interface Input extends StandingConfirmationInput {}`, same thing.

Related, smaller: `tasks/task-list.ts:32` `isVisible` is `!isArchived` and is used by nobody
(`selectVisible` calls `isArchived` directly); `compareText` at line 40 re-implements `Order.String`,
which `schedule/materialize.ts` already imports for the same job.

### 8. Error unions are declared two ways

`attendance/acknowledge.ts:35` and `decide-missed-lesson.ts:50` build runtime schemas
(`Schema.Union([...])`); `assessment/*` and `tasks/*` declare type-only unions
(`export type AttestWrittenError = A | B`). Both are exported from `index.ts` as if they were the
same kind of thing. Pick one — type-only unless something actually decodes a failure off the wire.

## TypeScript strictness

### 9. `exactOptionalPropertyTypes` is off, and it is the root cause of several items above

The root `tsconfig.json` sets a strong flag set — `noUncheckedIndexedAccess`, `noImplicitReturns`,
`noUnusedLocals/Parameters`, `allowUnreachableCode: false`, `verbatimModuleSyntax` — but not
`exactOptionalPropertyTypes`. Without it, `{ artifact: undefined }` is assignable to
`{ artifact?: Reference }`, so the compiler cannot distinguish "absent" from "present and
undefined". That distinction is load-bearing here: `Schema.optionalKey` is used on nearly every
aggregate, and `.make()` will write the key when the value is `undefined`.

The workarounds this forces are already in the code:
`organization/acknowledgement.ts:29` (`makeAcknowledgement` exists solely to strip a present-undefined
optional), the four-branch `LessonOccurrence.make` in `schedule/materialize.ts`, and the two
`Rejected.make` branches in `decide-missed-lesson.ts:151-158`.

**Measured cost of turning it on** (enabled at the root, `tsc --noEmit` per project):

| Project                  | New errors |
| ------------------------ | ---------- |
| `packages/core`          | 0          |
| `packages/server`        | 0          |
| `apps/console`           | 0          |
| `scripts`                | 0          |
| `packages/observability` | 1          |
| `apps/web`               | 6          |
| `apps/mobile`            | 31         |

38 errors, all one mechanical shape (`Type 'number | undefined' is not assignable to type
'number'` at an options object), concentrated in `apps/mobile/src/ui/`. The domain package and the
server package are already clean. This is as cheap as this flag will ever be.

### 10. `apps/mobile` is pinned to a different TypeScript major

`apps/mobile/package.json` declares `"typescript": "~6.0.3"`; the catalog pins `^7.0.2` and every
other workspace member uses `catalog:`. `apps/mobile/node_modules/typescript` really is 6.0.3. The
largest application in the repository is therefore checked by a different compiler than the
`@effect/tsgo`-patched one the lint configuration is built around. Move it to `catalog:` unless Expo
genuinely blocks it — and if it does, record why, because it silently weakens every strictness
decision made at the root.

### 11. Worth considering

`erasableSyntaxOnly` would stop `enum`/parameter-property syntax from entering a codebase that
already avoids both, and matches Node's type-stripping (`node src/index.ts` is how the console app
runs in dev).

## Lint configuration

The lint setup is genuinely excellent — three `@effect/tsgo` presets at error, the vendored
anti-slop plugin, and every disabled rule carrying a written justification. Two gaps.

### 12. The tsconfig diagnostic list has drifted from the oxlint presets

`vite.config.ts` derives its Effect rules programmatically from `correctness`, `antipattern` and
`style`. `tsconfig.json` restates the same set as ~80 hand-written `diagnosticSeverity` entries. They
have already diverged: `style` contains `effecttsgo/unnecessary-arrow-block`, and the tsconfig has no
`unnecessaryArrowBlock` — so CI errors on something the editor never flags. Any preset update widens
the gap. Either generate the tsconfig block (`effect-tsgo config` exists) or drop it and let oxlint
be the single source.

### 13. The `effect-native` preset is applied by hand, half of it

`vite.config.ts` enables eleven `effecttsgo/*-in-effect` rules individually. The preset also carries
`global-date`, `global-console`, `global-fetch`, `global-random`, `global-timers`, `process-env`,
`crypto-random-uuid`, `async-function`, `new-promise`, `node-builtin-import` and
`prefer-schema-over-json`, none of which are on anywhere. Skipping the non-`-in-effect` variants is
defensible in React code; `prefer-schema-over-json` and `node-builtin-import` are cheap wins and
`prefer-schema-over-json` would have flagged the raw `JSON.parse` in
`observability/src/client/outbox.ts:142`.

## Build, test and CI

### 14. `just qa` never runs the web app's tests

`vp run -r test` enumerates five packages and silently omits `@stu/web`:

```
[1] @stu/observability#test  [2] @stu/core#test  [3] @stu/server#test
[4] @stu/mobile#test         [5] @stu/console#test
```

Reproducible. `vp run --filter "./apps/**" test` includes it and all 28 tests pass. The five packages
`-r` finds are exactly the five that declare `test` in their `vite.config.ts`; `apps/web` declares it
in a separate `vitest.config.ts` because its `vite.config.ts` carries the TanStack Start and Nitro
plugins. So the web app's health-probe, lifecycle, shutdown, ingress and browser-client tests — the
ones the previous audit added to close findings 4 and 11 — have not run in `just qa` since they were
written. Fix by moving the `test.projects` block into `apps/web/vite.config.ts`, or by widening the
Justfile's filter.

### 15. No CI runs lint or tests

`.gitea/workflows/release.yml` is the only workflow and it only publishes a Release on push to
`main`. `nix/checks.nix` builds a genuinely good release smoke test, but nothing runs `just qa`.
Quality gating rests entirely on the local `.vite-hooks` pre-commit hook, which is per-clone and
bypassable. For a repository whose main investment is a strict lint configuration, that is the one
place the investment does not pay out. A `qa.yml` running `just qa` on push and pull request is
small and would also have caught finding 14 by making the missing project visible.

### 16. `"latest"` as a version specifier

`apps/web/package.json` uses `"latest"` for `@tanstack/react-router`, `react-start`,
`react-devtools`, `react-router-devtools`, `react-form`, `react-table` and
`@tanstack/devtools-vite`. The lockfile pins them today, and `pnpm-workspace.yaml`'s
`minimumReleaseAgeExclude` lists the exact resolved versions — so the intent to control TanStack
versions clearly exists, it is just recorded in the wrong file. Any fresh resolve moves these across
majors without a diff. Give them real ranges, or a catalog entry like everything else.

### 17. A failing container start reports the wrong error

`packages/server/src/database/database.integration.test.ts:19-21` — `afterAll` calls
`container.stop()` unconditionally, so when `beforeAll` cannot reach a container runtime the visible
failure is `TypeError: Cannot read properties of undefined (reading 'stop')` and the real cause is
gone. `await container?.stop()` restores it.

## Organization and duplication

### 18. `@stu/core` has no consumers

`grep` across the whole workspace: the only file importing `@stu/core` is
`packages/core/src/public-api.test.ts`. `apps/mobile` declares it as a dependency and imports it
zero times; `apps/web`, `packages/server` and `apps/console` neither declare nor use it.
`nix/workspace.nix:47` asserts `test ! -e ${webSource}/packages/core/src` — the release deliberately
excludes it.

The previous audit made this point and recommended a vertical slice; recording it again only because
the shape has since sharpened. `apps/mobile/src/compat/mobile-v0.ts` is not a thin DTO shim any more.
It is a 251-line parallel domain model with its own `isGradeConfirmed`, `isTaskArchived`,
`getCourseGrades`, `groupAbsencesByConfirmation` and `getRequiredSetupPath` — every one of which
`@stu/core` already models with better types. It is honestly marked `TODO`, and every mobile feature
now depends on it. Each new screen makes the eventual swap larger.

### 19. The mobile tsconfig defeats ADR 0001's bundle guidance

`apps/mobile/tsconfig.json` maps `"@stu/core": ["../../packages/core/src/index.ts"]`, collapsing the
package's fifteen subpath exports to the root barrel. ADR 0001 closes with "bundle-sensitive mobile
consumers should use the package's leaf exports rather than the coarse root namespace" — this
mapping makes that impossible, and `import { Assessment } from "@stu/core/assessment"` will not
resolve in mobile at all. Since mobile imports nothing from core yet, deleting the mapping now costs
nothing; `resolve: { tsconfigPaths: true }` plus the workspace link already handles resolution.

### 20. Four alias conventions

`#/*` (web, also declared in `package.json` `imports`), `@/*` and `~/*` (mobile, both mapped to
`./src/*`), plus relative imports. Mobile uses `~/` 350 times and `@/` 56 times, in the same files —
`features/tasks/screens/task-screen.tsx` imports from both. `apps/web/tsconfig.json` also declares
`@/*`, which nothing uses. Pick one per app and delete the rest; `#/` has the advantage of being a
real Node subpath import rather than a bundler-only fiction.

### 21. Directory names the project's own rule forbids

`AGENTS.md` says `lib`, `utils`, `helpers`, `common`, `shared`, `misc` and `types` are not directory
names. Present: `packages/observability/src/shared/`, `apps/mobile/src/types/`, `scripts/lib/`,
`tools/oxlint/anti-slop/shared/` (vendored, exempt). The observability one has already done what the
rule predicts — `shared/attributes.ts` and `shared/resource.ts` have nothing in common except not
belonging elsewhere. `resource.ts` is service identity; `attributes.ts` is the span/metric
vocabulary; `trace-context.ts` is W3C propagation. Three names exist.

### 22. Things defined twice

- **`TelemetryPriority`** — three times: a hand-written union in
  `observability/src/shared/attributes.ts:5`, an identical one in `client/outbox.ts:16`, and a third
  as `Schema.Literals(["low","normal","high"])` at `outbox.ts:117`. One `Schema.Literals` with
  `typeof X.Type` derives the other two.
- **Design tokens** — `apps/mobile/src/ui/colors.ts` and `apps/mobile/src/global.css` `@theme` hold
  the same palette as hand-synced hex literals, and have already drifted: `colors.accent.card`
  (`#203755`) has no CSS counterpart and `--color-grey-100` has no TS counterpart. Meanwhile
  `#FFFFFF` and `#000000` appear as literals 21 times despite `colors.surface` and
  `colors.on.surface` existing.
- **The OTLP layer** — `apps/web/src/infra/runtime/layer.server.ts:16-56` and
  `apps/console/src/runtime.ts:12-51` build the same layer from the same config with the same
  enabled/disabled branch, and already differ in two ways: web coerces the environment with
  `Config.map`, console decodes it with `Config.schema(Schema.Literals([...]))` (better); web falls
  back to `OtlpExporter.layerFlusher`, console to a hand-written `disabledFlusherLayer`.
  `@stu/observability` already exports `serviceNames`; it should own the assembly too —
  `otlpLayer({ serviceName })` — and both callers become one line.
- **`ClientTelemetryEnvelope`** is exported from `browser.ts` twice, once as a value and once as
  `type ClientTelemetryEnvelopeType`, same for `ClientTelemetryRecord`. The `*Type` aliases are
  unnecessary — `import { type X }` already works.

### 23. Effect is available and not used where it would shrink code

Two hand-rolled Promise state machines sit in a codebase whose lint configuration bans
`globalDateInEffect`, `globalRandomInEffect` and `globalTimersInEffect`:

- `observability/src/client/outbox.ts` (407 lines) implements a mutex (`#serial`), jittered
  exponential backoff (`retryDelay`), mutable snapshot state, and its own `TelemetryClock` /
  `TelemetryRandom` ports. Effect has `Effect.makeSemaphore(1)`,
  `Schedule.exponential(...).pipe(Schedule.jittered)`, `SynchronizedRef`, `Clock` and `Random` — the
  last two being precisely the injectable ports being hand-built here.
- `apps/web/src/infra/runtime/lifecycle.server.ts` (103 lines) hand-memoizes warm-up and shutdown
  promises with `warmup ??=`, `shutdown ??=` and a `warmed` flag, and declares both a
  `RuntimeLifecycle` and a `LifecycleController` interface where the first is the second plus one
  field.

Both are defensible if they must run outside a runtime — but mobile and web both _have_ Effect
runtimes (`MobileTelemetryProvider`, `applicationRuntime`). Worth an explicit decision recorded in
`packages/observability/README.md` rather than left implicit, because the outbox is the module most
likely to grow.

Relatedly, `apps/web/src/infra/http/health.server.ts:34-38` does dependency injection through three
optional constructor parameters (`runtimeState`, `pingDatabase`, `run`) so tests can substitute
them. That is a second DI mechanism beside Layers, in the package that defines the Layers.

### 24. Smaller items

- `apps/web/src/features/auth/header-user.tsx` is rendered nowhere, default-exports a function whose
  name (`BetterAuthHeader`) matches neither the file nor the export, hardcodes Tailwind instead of
  using `src/ui/button.tsx`, and uses `|| "U"` on a string. The previous audit flagged it as
  "lower-priority residue"; it is still there and it is the only file in `src/features/` on the web
  side, so it is currently the example any new feature will be modelled on. Delete it.
- `apps/mobile/src/infra/session/session.ts` returns hardcoded `"student-1"` / `"mock-session"` with
  no `TODO`, unlike `compat/mobile-v0.ts` which is properly marked. `useSession` is also a subset of
  `useRequiredAuthenticatedSession` with no caller distinction.
- `apps/mobile/src/infra/routing/params.ts` encodes calendar dates as epoch milliseconds in route
  parameters (`date.getTime()`, `new Date(timestamp)`) and hand-parses them with `Number.parseInt`
  and `split(";")`. Route parameters are a decode boundary, and ADR 0001 exists to keep exactly this
  from happening. `PlainDateSchema` encodes to `YYYY-MM-DD`, which is also a better URL.
- `OUTBOX_MAX_AGE_MS` / `OUTBOX_MAX_BYTES` are the only `SCREAMING_SNAKE` exports in the repository.
- `tools/oxlint/anti-slop/` is vendored with a LICENSE but no record of upstream repository, commit
  or version, and it has been reformatted by this repo's formatter plus one semantic edit
  (`shared/dictionary-types.ts`). Re-vendoring will be archaeology. A four-line README fixes it.
- `packages/server/README.md` refers to `schema/auth.ts` and `src/migration-history.ts`; the files
  are `src/auth/schema.ts` and `src/database/migration-history.ts`. `auth/better-auth.ts:24,29`
  repeats the stale `schema/auth.ts` path in two comments.
- `apps/web/.env.example` omits `STUDIENBUCH_OTEL_ENABLED`, `STUDIENBUCH_ENVIRONMENT`,
  `STUDIENBUCH_VERSION` and `STUDIENBUCH_WEB_HOST_NAMES`, all of which the server reads.
- `packages/server/drizzle.config.ts` points `schema` at the single file `./src/auth/schema.ts`. The
  first domain table will need a glob or a barrel; worth doing when it lands, not before.
- Better Auth is configured without `session.cookieCache`, `rateLimit`, or
  `emailAndPassword.requireEmailVerification`. Not wrong for a surface that does not exist yet, but
  `requireEmailVerification` is a decision to make before the first sign-up, not after.

## What is genuinely good

- The `packages/core` domain model. Schema-first values, errors in the error channel, no ambient
  clock, an ADR for civil time with measured bundle evidence, and `CONTEXT.md` as a real glossary.
  Findings 4-6 are about a second copy, not about the first one being wrong.
- The lint configuration, including every `off` carrying a written reason. This is rare.
- `organization/directory.ts` and `organization/academic-term.ts` as the model for how cross-entity
  validation should report failure.
- The Nix release story and `nix/checks.nix`'s end-to-end smoke test.
- `docs/product/legacy-behavior/` separating disposition from confidence.
- Naming discipline throughout — `AuthoritySnapshot`, `MissedLessonDecision`, `AbsenceStatus`,
  `detailsRevision` are all names that carry their own explanation.

## Suggested order

1. Finding 1 (withdrawal tombstone) with a regression test. Small, and it is a real bug.
2. Finding 9 (`exactOptionalPropertyTypes`) and finding 10 (mobile TypeScript version). Mechanical,
   38 errors, and 9 removes the machinery that finding 5 has to work around.
3. Findings 14 and 15 (web tests not running; no CI). Cheap, and everything after this is safer once
   `just qa` actually covers the repository and runs somewhere other than a laptop.
4. Findings 4, 5 and 6 — the confirmation lifecycle, the `revise` helper, and structured errors for
   referential invariants. This is the largest piece and the one that pays off most as the domain
   grows. Finding 1 becomes unrepresentable, finding 3 disappears.
5. Findings 20, 21, 22 — aliases, directory names, things defined twice. Individually trivial,
   collectively what "clean organization" means once there are twenty features instead of eight.
6. The vertical slice the previous audit called for (finding 18). Everything above makes it cheaper;
   nothing above depends on it.
