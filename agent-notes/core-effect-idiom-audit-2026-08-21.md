# `packages/core` — Effect idiom, simplicity, and structure — 2026-08-21

Scope: `packages/core` only, weighted toward Effect usage, readability, and the module conventions
the package will carry as it grows. This is a second pass on top of
`best-practices-audit-2026-08-21.md`, which covered the whole repository and whose core findings
(1, 3, 4, 5, 6, 7, 8) are being actioned in a concurrent session. Everything already recorded there
is referenced, not repeated.

Baseline read: `mqvqvvqqnksm` / `934d60e04ebc` ("wip: adopt the smaller Project runtime"), before
that session began editing. `effect@4.0.0-rc.108`, checked against
`~/context/effect-ts-effect` at `@4.0.0-rc.110-26-g770c6d0f0`.

Every claim below marked _verified_ was run as a real test in `packages/core` and passed. The probe
files have been deleted.

The short version: the domain modelling is good and the tests are good. What is overcomplicated is
almost entirely **restatement** — the same fact written down a second time in a second syntax, then
kept in sync by hand. Thirteen error unions nobody imports, sixty-seven lines of schema in
`importing/` nothing calls, two module idioms for one kind of value, and three hand-rolled copies of
`Order.Number`. None of it is wrong. All of it is a maintenance surface that grows linearly with the
domain.

---

## 1. A correctness bug: `NonBlankText` does not validate at construction — high

`foundation/non-blank-text.ts:6-21`. Verified:

```
Schema.Struct({ name: NonBlankText.Schema }).make({ name: "   " })   → ACCEPTED
Schema.decodeUnknownEffect(same)({ name: "   " })                    → rejected
```

The one schema in the package whose entire purpose is "at least one non-whitespace character" is the
one schema that does not enforce it on the path the package actually uses. Every other value does
enforce at `make` — `PersonId.make("")` throws, `PersonId.make(" x ")` throws, and the struct-level
filters on `AbsenceCase` throw. Verified for all of those too.

The cause is the two-sided construction:

```ts
const Declared = Schema_.declare<Type>((input): input is Type => isNonEmptyString(input), ...);
export const Schema = Schema_.String.check(nonBlankFilter).pipe(Schema_.decodeTo(Declared));
```

The real predicate (`trim().length > 0`) sits on the `String` side, which only runs on decode. The
`Type` side is `Declared`, whose guard is `Schema.NonEmptyString` — length, not blankness. So
`"   "` passes the make-time guard.

This reaches production data. `NonBlankText.Schema` is the type of `Person.name.displayName`,
`Subject.name`, `AcademicTerm.name`, `SchoolTask.title`, `CalendarClosure.name`,
`RecurringMeeting.room`, `AbsenceReason.Other.description` and the rejection reason on a missed
lesson. A whitespace-only course name entered through any `make` call is accepted and stored, and
only fails if it is ever re-decoded.

Minimal fix, verified to reject `"   "` at `make`, at decode, and to keep `Schema.String` as the
encoded representation:

```ts
const isNonBlank = (input: unknown): input is Type =>
  typeof input === "string" && input.trim().length > 0;
const Declared = Schema_.declare<Type>(isNonBlank, { identifier: "NonBlankText" });
export const Schema = Schema_.String.pipe(Schema_.decodeTo(Declared));
```

Three declarations become two, the separate `makeFilter` and the `isNonEmptyString` guard both go
away, and the module drops from 23 lines to about 12. The template-literal `Type` — which is what
lets `title: "Klausur 1"` be written without a construction call, and which is genuinely clever —
is unaffected.

This needs a test. `foundation/foundation-values.test.ts:37` covers the decode path
("validates non-blank text while preserving authored spacing") and that is exactly why the gap
survived: the make path was never asserted.

---

## 2. Thirteen error unions, zero consumers — and the README says not to write them

`packages/core/README.md` already states the rule:

> There is deliberately no companion `Error` type. `Effect.fn` already infers the error channel, so
> restating it is a second declaration to keep in sync for no gain.

There are thirteen of them:

| Declaration                                                    | File                                    |
| -------------------------------------------------------------- | --------------------------------------- |
| `AcknowledgeError` (runtime `Schema.Union` + type)             | `attendance/acknowledge.ts:32`          |
| `DecideMissedLessonError` (runtime `Schema.Union` + type)      | `attendance/decide-missed-lesson.ts:49` |
| `WithdrawAbsenceError`                                         | `attendance/withdraw.ts:26`             |
| `ScheduleMaterializationError` (runtime `Schema.Union` + type) | `schedule/lesson-occurrence.ts:73`      |
| `materializeSchoolDay.Error`                                   | `schedule/materialize.ts:215`           |
| `AttestWrittenError`                                           | `assessment/written-assessment.ts:83`   |
| `AcknowledgeWrittenError`                                      | `assessment/written-assessment.ts:90`   |
| `WithdrawWrittenError`                                         | `assessment/written-assessment.ts:178`  |
| `ReviseStandingError`                                          | `assessment/course-standing.ts:140`     |
| `AttestStandingError`                                          | `assessment/course-standing.ts:150`     |
| `AcknowledgeStandingError`                                     | `assessment/course-standing.ts:159`     |
| `RestoreStandingError`                                         | `assessment/course-standing.ts:342`     |
| `TransitionError`                                              | `tasks/school-task.ts:71`               |

`grep` across the whole workspace: not one of them is referenced by anything except its own
definition and its `index.ts` re-export. Not by the functions that produce them — `Effect.fn` infers
the channel — and not by any test.

Two are worth separating out:

- **`ScheduleMaterializationError` and `materializeSchoolDay.Error` are the same union written twice
  in two files**, three members each, and both are dead. That is the drift the README warns about,
  already realized.
- **Three are runtime `Schema.Union` values**, not type aliases. They are constructed at module load
  and re-exported from `schedule/index.ts` and `attendance/index.ts`, so importing either domain
  barrel pulls the union node and its members into the bundle whether or not the consumer touches
  them. On the mobile side that is exactly what ADR 0001's leaf-export guidance is trying to avoid.

Deleting all thirteen removes about 90 lines and cannot break a caller, because there are none. If a
name is wanted later for a UI exhaustiveness check, `Effect.Effect.Error<ReturnType<typeof
acknowledge>>` derives it from the one source of truth instead of restating it.

---

## 3. `importing/` declares its whole model twice, and the schema half is unreachable

`importing/` is the one module where every union exists as both a schema constructor and a
hand-written type. Verified reachability:

| Export                                     | Called by               |
| ------------------------------------------ | ----------------------- |
| `IncomingReconciliationResult` (schema fn) | nothing                 |
| `SourceDeletionResult` (schema fn)         | nothing                 |
| `ProvenancedValue` (schema fn)             | only the two above      |
| `SourceObservation` (schema fn)            | only the two above      |
| `UserOverride` (schema fn)                 | only `ProvenancedValue` |

A closed cycle of five exported schema constructors that nothing outside the cycle enters.
Approximately 67 lines — `reconciliation.ts:10-30`, `reconciliation.ts:67-83`,
`provenanced-value.ts:6-32`, `source.ts:26-27` — whose only purpose is to mirror the hand-written
types on the next screen. Every actual value in the module is built as a plain object literal
(`reconciliation.ts:131`, `:141`, `:145`, `:150-151`, `:155-162`, `:171-188`;
`provenanced-value.ts:47-65`), so no schema ever runs.

The two declarations have already drifted in the way this shape always drifts. `ProvenancedValue`'s
schema says `source: Schema.optionalKey(observation)` while `OverriddenValue` says
`readonly source?: SourceObservation<Value>` — same intent today, but nothing checks that, and the
`reconcileIncoming` result type is 26 hand-maintained lines that must stay aligned with a 20-line
schema nobody executes.

Two coherent choices; the current state is neither.

**Delete the schemas** if import reconciliation stays in-memory. That is the honest reading of the
code today: `reconcileIncoming` and `reconcileSourceDeletion` are pure functions over values the
caller already holds, and nothing crosses a wire. Removes 67 lines and the drift risk outright.

**Keep the schemas and derive the types** if a persisted `ProvenancedValue` column or a sync envelope
is coming. TypeScript can do this — instantiation expressions in type position work, verified:

```ts
type Boxed<A extends Schema.Top> = typeof boxed<A> extends (a: A) => infer R
  ? R extends Schema.Top
    ? R["Type"]
    : never
  : never;
```

The current arrangement pays the cost of the second option while getting the guarantees of neither.

Two smaller things in the same file, both against the project's own "no one-line casting wrappers"
rule: `reconciliation.ts:112` `jsonEquals` is `Equal.equals` renamed, and `:107` `sameDataSource` is
`left.id === right.id` renamed and used once.

---

## 4. Two module idioms for one kind of value, chosen by directory rather than by need

This is the largest readability tax in the package, and the reason the trailing-underscore imports
exist.

**Idiom A — declaration merging.** Used by roughly 80% of the package.

```ts
import * as Schema from "effect/Schema";
export const GradeLevel = Schema.Int.check(...).pipe(Schema.brand("GradeLevel"));
export type GradeLevel = typeof GradeLevel.Type;
```

Four lines. `GradeLevel` is both the schema and the type. No aliasing, no self-export. This is how
`SchoolId`, `PersonId`, `GradeValue`, `AssessmentWeight`, `AcademicTerm`, `Person`, `SchoolTask`,
`LessonOccurrence` and every other entity in the package is written.

**Idiom B — the value-namespace module.** Used by eight files.

```ts
import * as Schema_ from "effect/Schema";
import * as Order_ from "effect/Order";
export const Schema = Schema_.Int.check(...).pipe(Schema_.brand("LocalTime"));
export type Type = typeof Schema.Type;
export const compare = ...
export * as LocalTime from "./local-time";
```

Costs: every Effect import in the file needs a disambiguating alias, the member is called `Schema`
and the type is called `Type` so call sites read `LocalTime.Schema.make(...)` and
`AggregateRevision.Type`, and the module self-exports its own namespace.

Idiom B is legitimate and Effect uses it — `Duration.Order`, `DateTime.Equivalence`,
`Duration.Duration` are all real. But Effect earns it: `Duration` has forty operations. And Effect
differs in two ways worth copying:

- **Effect never self-exports.** `Duration.ts` does not contain `export * as Duration from
"./Duration.ts"`; `index.ts` does it. Here every idiom-B module re-imports itself. It works, but
  it is a concept the reader has to absorb that upstream does not have.
- **Effect's aliases are `order` and `Equ`** (`Duration.ts:14,20`, `DateTime.ts:17,24`), not
  `Order_` / `Equivalence_` / `Schema_`. Cosmetic, but if the trailing underscore is going to stay
  it should be a written convention rather than an accident.

The real problem is that the choice tracks the directory, not the value. Operation counts:

| Module              | Operations                        | Idiom          |
| ------------------- | --------------------------------- | -------------- |
| `LocalTime`         | 8                                 | B — earned     |
| `CalendarDateRange` | 4                                 | B — earned     |
| `Artifact`          | 4 nested types                    | B — earned     |
| `LocalTimeRange`    | 3                                 | B — earned     |
| `AggregateRevision` | 3, all reimplementations (see §5) | B — not earned |
| `SourceRevision`    | 3, all reimplementations          | B — not earned |
| `NonBlankText`      | 0                                 | B — not earned |
| `Weekday`           | 0                                 | B — not earned |

`schedule/weekday.ts` is eight lines of ceremony around `Schema.Literals([1,2,3,4,5,6,7])`. Under
idiom A it is two lines and reads `weekday: Weekday` instead of `weekday: Weekday.Schema`.

Suggestion: state the rule — **a value gets its own namespace module when it has operations of its
own; otherwise it is a `const` and a `type` of the same name** — and move `Weekday`, `NonBlankText`,
`AggregateRevision` and `SourceRevision` to idiom A. That is four files and it removes every
`Schema_` alias in the package.

Related, smaller: `foundation/index.ts` exports four namespaces and one bare
`PlainDateSchema`. `CalendarDateRange.Schema` and `PlainDateSchema` are two values at the same level
named by two different rules. `PlainDate` legitimately has no operations of its own because Temporal
owns them, so under the rule above it is idiom A and the name should be `PlainDate` — except that
collides with the Temporal import. `PlainDateSchema` is the pragmatic answer; it just deserves the
one-line comment saying so.

---

## 5. `Order.Number` and `Equivalence.Number` already exist

`Order.ts:144,177` and `Equivalence.ts:242`. Verified present at this version.

`AggregateRevision` and `SourceRevision` are both branded `Schema.Natural`, and both hand-write:

```ts
export const compare = (left: Type, right: Type): -1 | 0 | 1 =>
  left < right ? -1 : left > right ? 1 : 0;
export const Equivalence = Equivalence_.make<Type>((left, right) => compare(left, right) === 0);
export const Order = Order_.make<Type>(compare);
```

Character-for-character identical between the two files, and semantically identical to
`Order.Number` / `Equivalence.Number`. `LocalTime` has a third copy of `compare`, and
`tasks/task-list.ts:41` `compareText` is a fourth copy of `Order.String` — which
`schedule/materialize.ts` and `schedule/collisions.ts` already import for the same job.

Effect defines `Duration.Order` because `Duration` is a struct with two representations. A branded
`number` needs nothing. `AggregateRevision.Equivalence(a, b)` at `withdraw.ts:43`,
`acknowledge.ts:43`, `decide-missed-lesson.ts:62` and `school-task.ts:105` can be `a === b`, which
is what `written-assessment.ts:99` and `course-standing.ts:170` already write for the same check.

---

## 6. `Effect.fn` is applied uniformly where it should be applied selectively

28 sites, all but one named. A named `Effect.fn` creates a tracing span on every call
(`Effect.ts:13602`); the unnamed form only captures a stack frame; `Effect.fnUntraced` does neither.
Right now the distinction is not being used.

**Private helpers get public spans.** `SchoolTask.withStatus`, `Assessment.currentStandingTarget`
and `Assessment.updateCurrentStanding` are module-private and each produces a span inside its
caller's span, describing an implementation detail rather than a domain operation.

**One span per grade in a loop.** `grading-policy.ts:116` calls `validateValue` — itself
`Effect.fn("GradingPolicy.validateValue")` — once per assessment inside `average`'s loop. A student
with 30 written assessments produces 30 child spans for a range comparison against two numbers, on
every average recalculation. In a local-first app that recomputes on every write, this is the one
place where the uniform treatment has a measurable cost.

**Span names disagree with export names, and one is stale.**

| Export                           | Span                                                         |
| -------------------------------- | ------------------------------------------------------------ |
| `reviseStanding`                 | `Assessment.addStandingRevision` — renamed, span not updated |
| `attestWritten`                  | `Assessment.attestWrittenAssessment`                         |
| `acknowledgeWritten`             | `Assessment.acknowledgeWrittenAssessment`                    |
| `withdrawWritten`                | `Assessment.withdrawWrittenAssessment`                       |
| `attestStanding`                 | `Assessment.attestStandingRevision`                          |
| `complete` / `reopen` / `cancel` | `SchoolTask.*`                                               |

The last row matters most: the domain namespace is `Tasks` everywhere else, including the error tag
`Tasks.ConcurrentRevision` in the same file. So a trace shows `SchoolTask.complete` failing with
`Tasks.TaskTransitionRefused` and the two names do not obviously belong to each other. The README
gives errors one naming rule; spans have none.

Suggestion: name the span exactly `<DomainNamespace>.<exportedName>` and nothing else, and use
`Effect.fnUntraced` (or a plain function returning `Effect.gen`) for module-private helpers. Then a
span name is derivable from the export and cannot go stale.

---

## 7. `Schema.makeFilter` can return a structured issue — this is the answer to finding 6

The previous audit's finding 6 recommends replacing opaque boolean `makeFilter`s with a separate
structured-error validator, on the grounds that a boolean destroys the information the caller needs.
The premise is right and the remedy is heavier than necessary: `makeFilter` already accepts a
`FilterOutput` of `string | SchemaIssue.Issue | { path, issue }` (`Schema.ts:6586-6614`).

Verified — returning `{ path: ["items", index, "id"], issue: \`duplicate id ${item.id}\` }` produces:

```
duplicate id a
  at ["items"][1]["id"]
```

So `authority.ts:34-89` can keep being one filter on `AuthoritySnapshot` and still say _which
membership row_ broke _which rule_, without a second `validateAuthoritySnapshot` function that
callers must remember to run. Same for `absence-case.ts:53-90` (six invariants, one message),
`course-standing.ts:53-85`, `catalog.ts:26-33`, `enrollment.ts:37-59`, `written-assessment.ts:37-50`
and `academic-calendar.ts:22-31`.

`organization/directory.ts` stays as it is — it validates across eight collections that are not one
schema, so a function returning a tagged error is right there. The point is that it should be the
exception, not a second convention competing with `makeFilter`.

---

## 8. `Schema.optional` collapses the branch-per-optional-key pattern at no wire cost

The package bends over backwards to avoid passing a present `undefined` to `make`:

- `organization/acknowledgement.ts:29-35` — `makeAcknowledgement` exists solely to strip one field
- `schedule/materialize.ts:94-102` — four `LessonOccurrence.make` calls to cover two optional keys
- `attendance/decide-missed-lesson.ts:136-139` — two `Rejected.make` branches
- `tasks/school-task.ts:157-159` — two `Cancelled.make` branches
- `attendance/decide-missed-lesson.ts:166-171` — two `AbsenceCase.make` branches

A third optional key on `LessonOccurrence` makes it eight branches. The previous audit proposed a
`defined`-stripping helper; I tried writing one and it needs two `no-unsafe-type-assertion`
suppressions plus an `anti-slop/no-known-value-widening` suppression, because the project's lint
rules deliberately ban that shape.

`Schema.optional` is the cheaper answer. Measured, `Schema.optional(Schema.String)` with
`note: undefined`:

|                             | `optionalKey` | `optional`                 |
| --------------------------- | ------------- | -------------------------- |
| `make({ note: undefined })` | throws        | accepted                   |
| in-memory key               | absent        | present, value `undefined` |
| `encode` → `JSON.stringify` | `{"id":"x"}`  | `{"id":"x"}`               |
| decode round-trip           | key absent    | key absent                 |

The encoded JSON is identical, so nothing about sync or persistence changes, and the in-memory
difference normalizes on the first round trip. Core reads every one of these fields with
`=== undefined`, which is correct under both. Switching the construction-heavy fields deletes all
five branch sets and `makeAcknowledgement` outright.

The one thing this forecloses is distinguishing "absent" from "explicitly cleared" on the wire. Core
does not currently make that distinction anywhere, but it is the kind of thing an event-sourced sync
layer might later want — worth a sentence in the ADR either way.

---

## 9. Smaller items

**`public-api.test.ts` tests ECMAScript, not Studienbuch.** 91 lines, of which about 40 are
`expect(X).toBe(Y)` assertions that a re-export re-exports the same object. That is guaranteed by
the module system. The genuine content is the 35 import statements at the top — those prove the
`package.json` subpath map resolves, and `tsc` proves it at compile time already. Worth keeping:
line 59's `const text: NonBlankText.Type = "Lesson notes"` demonstrates the one ergonomic property
that is easy to break. The rest can go. The nine domain test files are the opposite — behaviour-named,
one behaviour each, no smoke slop.

**`tasks/task-list.ts:29` `isVisible` is dead.** It is `!isArchived`, it is exported through
`tasks/index.ts`, and nothing calls it — `selectVisible` inlines `!isArchived(...)` at line 71.

**`schedule/collisions.ts:25-36` `pairs()` fights `noUncheckedIndexedAccess` for no reason.** Two
index reads with two `undefined` guards that cannot fire. `organization/academic-term.ts:61-62`
already writes the same double loop cleanly with `entries()` and `slice(index + 1)`, and neither
guard is needed there. Same file, `orderedPair` and `comparePairs` are generic over `Id extends
string` and used three times each — that part is good.

**`organization/authority.ts:190-198` and `:213-220` are the same ten lines.** The
`ManageCourseOffering` and `DecideCourseAttendance` arms compute an identical `assigned` predicate
and deny with the same reason. One `isAssignedTeacher(actorMembership, target, on)` beside
`activeOn` and `isAdministratorFor` removes it.

**`schedule/academic-calendar.ts:53-59` reimplements a max.** A three-line `reduce` with an
`undefined` accumulator to find the latest term end; `Order.max` over `PlainDate.compare` says it
directly. The same file's overlap check at `:25-29` duplicating `validateAcademicTerms` is already
recorded as finding 6.

**Index barrels restate 167 names.** `organization/index.ts` alone relays 45. Every new export is two
edits — the definition and the barrel — and a missed barrel edit is invisible until a consumer needs
the symbol. This is the deliberate "each domain index is its public contract" design and it is
defensible, but with the thirteen dead error unions (§2) and the five dead schema constructors (§3)
removed, the barrels drop by about 20 names for free, which is worth doing before deciding whether
the pattern needs changing at all.

**`assessment/AlreadyWithdrawn` naming a target it cannot produce** — recorded as finding 3 in the
previous audit, still open, and it is a symptom of the confirmation-lifecycle duplication the
concurrent session is fixing.

---

## What is genuinely good, and should not be touched

- **The domain model.** `AbsenceCase` separating `detailsRevision` from `revision` so a teacher
  decision does not invalidate a guardian's acknowledgement; `CourseStanding` moving a pointer
  instead of deleting later revisions, with the comment explaining why legacy's truncation cannot
  converge across two devices; withdrawal as a tombstone rather than a delete. These are the
  decisions that make the local-first story work, and each one carries the reasoning in a comment
  where the next reader will find it.
- **The nine domain test files.** Behaviour-named, one behaviour per test, no regression padding.
  `"does not trust an unrelated person record for the legal-age decision"` and `"orders exception ids
by code point, not by the runtime's locale"` are tests that would catch a real regression and
  explain it in the failure line.
- **`CONTEXT.md`.** A glossary with an `_Avoid_` line per term is the cheapest possible defence
  against the vocabulary drifting once more than one person writes here.
- **No ambient clock anywhere.** Every dated decision takes its date as a parameter. That is what
  makes replay and projection possible at all, and it has been held consistently.
- **ADR 0001 with measured bundle numbers.** An ADR that records the actual byte counts and the
  conditions that invalidate them is rare.

---

## Outcome, same day

Everything below landed. `§1`, `§2` and `§7` were taken by the concurrent session
(`fix(core): validate non-blank text at construction, locate snapshot failures` and
`refactor(core): share the aggregate revision protocol`); the rest is
`refactor(core): stop restating what the code already says`. Net −124 lines across
`packages/core`, no behaviour change, `just qa` green.

| §                          | Outcome                                                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 NonBlankText             | Fixed by the other session, and better than proposed: it derives the guard from the one `nonBlank` schema with `Schema.is`, because `typeof input === "string"` trips `anti-slop/no-runtime-typeof`. Three tests now cover construction, decode and spacing. |
| 2 Error unions             | All thirteen deleted.                                                                                                                                                                                                                                        |
| 3 `importing/` schemas     | Five constructors deleted, types kept. Hauke's call. `SourceObservation` now carries a comment saying where to put a schema back when import state is persisted.                                                                                             |
| 4 Module idioms            | `Weekday` and `NonBlankText` moved to the `const`-and-`type` idiom. The rule is now written in the README.                                                                                                                                                   |
| 5 `Order.Number`           | Three `compare`/`Equivalence`/`Order` triples reduced to one `compare` each; `compareText` replaced by `Order.String`.                                                                                                                                       |
| 6 Spans                    | Renamed to `<DomainNamespace>.<exportedName>`; private helpers and `validateValue` are `fnUntraced`.                                                                                                                                                         |
| 7 Structured filter issues | Taken by the other session.                                                                                                                                                                                                                                  |
| 8 `Schema.optional`        | Adopted package-wide after Hauke chose one rule over two. See the correction below.                                                                                                                                                                          |
| 9 Smaller items            | `isVisible`, `pairs()`, the duplicated `authorize` arms and `public-api.test.ts` all done.                                                                                                                                                                   |

### Corrections to this note

**§4's table was wrong about `AggregateRevision` by the time it was read.** It listed the
module as having "3 operations, all reimplementations" and therefore not earning its
namespace. The concurrent session's `revise`, `ensureCurrent`, `Concurrent` and
`AggregateName` landed in that file in between, so it now clearly earns one under the very
rule §4 proposes. It was left as a namespace module.

**§9's "`nextSchoolDay` reimplements a max" was a weak finding and was not taken.**
`Array.max` needs a `NonEmptyArray` and `PlainDate.compare` returns `number` rather than
`Ordering`, so the replacement was longer and needed two more imports than the `reduce` it
replaced. Only the redundant `PlainDate.equals(candidate, latestTermEnd)` break came out —
the loop condition already covered it.

**§8 carried a risk this note did not state, and the other session was right to raise it.**
`Schema.optional` admits two in-memory representations of absence (`{k: undefined}` and
`{}`), and a sync layer hashing an _encoded object_ structurally would see them differ even
though `JSON.stringify` does not. The note only measured the JSON, which was not the whole
question. It went to Hauke as a domain decision rather than a cleanup, and he chose one rule
for the package; the constraint that follows is recorded in the README, so whatever
canonicalizes values for sync has to normalize first.

---

## Suggested order

1. **§1, `NonBlankText`** — a real bug, a four-line fix, and a test for the make path. Independent
   of everything the concurrent session is doing.
2. **§2 and §3, the dead declarations** — 13 error unions and 5 schema constructors, roughly 160
   lines, zero consumers, zero risk. Do this before §4 so the barrels shrink first.
3. **§7 and §8** — structured filter issues and `Schema.optional`. Both change how the concurrent
   session's findings 5 and 6 are best implemented, so they are worth deciding on early even if the
   work lands later.
4. **§6, span discipline** — mechanical, and it stops the naming from drifting further.
5. **§5 and §4** — `Order.Number`, then the module-idiom rule. §4 is four files but it touches call
   sites across the package, so it wants a quiet moment rather than a contested one.
6. **§9** — individually trivial, collectively what keeps the package readable at twenty domains
   instead of seven.
