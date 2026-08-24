# `@stu/core`

`@stu/core` is Studienbuch's runtime-independent school-life domain. It owns validated vocabulary,
business invariants, deterministic projections, and composable decisions. It does not own React,
persistence, synchronization transports, database rows, or provider payloads.

The canonical school language is recorded in [CONTEXT.md](./CONTEXT.md).

## Start here

Read the package by following a domain question, not by looking for technical buckets such as
`model.ts` or `workflows.ts`:

| Question                                                   | Module         | Good first file             |
| ---------------------------------------------------------- | -------------- | --------------------------- |
| What are our shared dates, revisions, text, and artifacts? | Root values    | `src/foundation/index.ts`   |
| How is a school organized, and who may act?                | `Organization` | `src/organization/index.ts` |
| Which lessons happen on a date?                            | `Schedule`     | `src/schedule/index.ts`     |
| How is an absence acknowledged and resolved?               | `Attendance`   | `src/attendance/index.ts`   |
| How are results attested, acknowledged, and averaged?      | `Assessment`   | `src/assessment/index.ts`   |
| How do school tasks move through their lifecycle?          | `Tasks`        | `src/tasks/index.ts`        |
| How are provider observations reconciled with overrides?   | `Importing`    | `src/importing/index.ts`    |

Each domain index is its deliberate public contract. Files behind it are organized around concepts
or substantial use cases and may change without creating another public API.

## Public interface

Domain surfaces use named ES-module namespace projections. Foundational values are promoted
directly from both the package root and the focused Foundation subpath:

```ts
import { Attendance, PlainDateSchema } from "@stu/core";
import { Schedule } from "@stu/core/schedule";
import { gen } from "effect/Effect";
import { decodeEffect } from "effect/Schema";

const program = gen(function* () {
  const day = yield* decodeEffect(PlainDateSchema)("2026-08-14");
  const status = Attendance.status(absence);
  return yield* Schedule.materializeSchoolDay({ calendar, date: day, meetings, exceptions });
});
```

Bundle-sensitive clients may import a named value namespace directly, for example
`import { Artifact } from "@stu/core/foundation/artifact"`. This avoids making Temporal reachable
when the client does not use calendar dates; prefer leaf subpaths for new mobile code.

Substantial object-input operations keep their input type discoverable through a type-only
companion namespace:

```ts
const acknowledge = (input: Attendance.acknowledge.Input) => Attendance.acknowledge(input);
```

There is deliberately no companion `Error` type. `Effect.fn` already infers the error channel, so
restating it is a second declaration to keep in sync for no gain.

This follows Effect's namespace pattern: indexes project ordinary ESM modules as named namespaces,
while declaration merging keeps an operation's types discoverable. Runtime TypeScript namespaces
are not used, and Core-owned modules are consumed with named imports rather than `import * as`.
The canonical namespace is self-exported by its owning module; do not split a concept into separate
implementation and namespace-facade files. Domain indexes only relay those established identities.

## Modeling conventions

- A failure is a `Schema.TaggedError` whose tag is `Domain.ClassName`, and whose class name is
  exactly the tag's local part: `class AlreadyTeacherAttested` tagged `"Assessment.AlreadyTeacherAttested"`.
  No `Error` suffix; the error channel already says what it is. The namespace lives in the tag so a
  log line is self-describing and two domains can both have an `AcknowledgementActor`.
- Boundary and persisted values are Effect schemas. Decode them with `Schema.decodeEffect` or
  `Schema.decodeUnknownEffect`; schema issues remain in the Effect error channel.
- Provider-backed schedule occurrences keep every provider claim and its raw source identity.
  They do not invent a recurring meeting or resolved course when neither link exists yet.
- Civil school dates use timezone-free Temporal plain-date values, and local lesson times use
  milliseconds since midnight. Neither is a JavaScript `Date`; absolute audit timestamps use
  Effect's UTC date-time value and elapsed time uses Effect `Duration`.
- Pure calculations remain ordinary total functions. Typed refusal, validation, and finite-domain
  exhaustion use `Effect`; Core exports no `unsafe…` construction or parsing APIs.
- Domain operations receive the relevant date, actor, and evidence explicitly. Replay and
  projections never consult an ambient clock.
- Services model real institutional variability, not every helper. `Assessment.GradingPolicy` is
  the current example.
- Internal modules import owning leaves directly; callers import the public domain namespace.
- Foundation values are imported directly (`PlainDateSchema`), never through a `Foundation` namespace.
- Entity IDs live with their owning domain (`Organization.PersonId`, `Schedule.LessonOccurrenceId`),
  not in a global registry.
- A value gets its own namespace module (`LocalTime.Schema`, `LocalTime.compare`) when it has
  operations of its own. Otherwise it is a `const` and a `type` of the same name, the way
  `GradeLevel` and `PersonId` are. The namespace is earned by behaviour, not applied by default:
  `Weekday` is one literal union and reads better as `weekday: Weekday`.
- Optional fields use `Schema.optional`, never `Schema.optionalKey`. Both encode identically —
  `JSON.stringify` drops an `undefined` either way — but `optionalKey` rejects a present
  `undefined` at `make`, which forces a construction branch per optional key and made a
  four-branch `LessonOccurrence.make` out of two of them. Anything that hashes an encoded value
  structurally must normalize first; the wire format does not distinguish the two.
- A traced `Effect.fn` is named `<DomainNamespace>.<exportedName>` and nothing else, so the span
  name is derivable from the export and cannot go stale. Module-private helpers and anything
  called inside a loop use `Effect.fnUntraced`: a span per grade is noise, not signal.
- Ordering on a branded `number` is `===` and `Order.Number`. Do not hand-write `compare`,
  `Equivalence` and `Order` triples; Effect defines its own only for values like `Duration` that
  have more than one representation.
- Cross-entity invariants that belong to one schema stay in `Schema.makeFilter`, which returns
  `{ path, issue }` and can therefore name the offending element. A separate validating function
  is for invariants spanning collections that are not one schema — `validateSchoolDirectory` is
  the example, and it is the exception.

The civil-time representation and its bundle trade-off are recorded in
[ADR 0001](./docs/adr/0001-model-civil-time-explicitly.md).
