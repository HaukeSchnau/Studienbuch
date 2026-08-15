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
| What are our shared dates, revisions, text, and artifacts? | `Foundation`   | `src/foundation/index.ts`   |
| How is a school organized, and who may act?                | `Organization` | `src/organization/index.ts` |
| Which lessons happen on a date?                            | `Schedule`     | `src/schedule/index.ts`     |
| How is an absence acknowledged and resolved?               | `Attendance`   | `src/attendance/index.ts`   |
| How are results attested, acknowledged, and averaged?      | `Assessment`   | `src/assessment/index.ts`   |
| How do school tasks move through their lifecycle?          | `Tasks`        | `src/tasks/index.ts`        |
| How are provider observations reconciled with overrides?   | `Importing`    | `src/importing/index.ts`    |

Each domain index is its deliberate public contract. Files behind it are organized around concepts
or substantial use cases and may change without creating another public API.

## Public interface

The package root exposes ES-module namespace projections. Focused subpaths expose the same domain
interface without loading the root:

```ts
import { Attendance, Foundation } from "@stu/core";
import * as Schedule from "@stu/core/schedule";

const day = Foundation.CalendarDate.unsafeFromString("2026-08-14");
const status = Attendance.status(absence);
const lessons = Schedule.materializeSchoolDay({ calendar, date: day, meetings, exceptions });
```

Bundle-sensitive clients may import a value module directly, for example
`import * as Artifact from "@stu/core/foundation/artifact"`. This avoids making Temporal reachable
when the client does not use calendar dates; prefer leaf subpaths for new mobile code.

Substantial object-input operations keep their operation-specific types discoverable through
type-only companion namespaces:

```ts
const acknowledge = (input: Attendance.acknowledge.Input) => Attendance.acknowledge(input);

type AcknowledgeFailure = Attendance.acknowledge.Error;
```

This is the useful namespace pattern from Effect itself: runtime organization remains ordinary ESM,
while declaration merging keeps an operation's types discoverable. Runtime TypeScript namespaces
are not used.

## Modeling conventions

- Boundary and persisted values are Effect schemas. Companion value modules expose them as
  `.Schema` and `.Type`, alongside their construction and domain operations.
- Decode untrusted values at the boundary. Use a schema's `.make` only for trusted construction.
- Civil school dates use timezone-free Temporal plain-date values, and local lesson times use
  milliseconds since midnight. Neither is a JavaScript `Date`; absolute audit timestamps use
  Effect's UTC date-time value and elapsed time uses Effect `Duration`.
- Pure calculations remain ordinary total functions. Use `Effect` when a decision has typed refusal
  or a genuine runtime policy dependency.
- Domain operations receive the relevant date, actor, and evidence explicitly. Replay and
  projections never consult an ambient clock.
- Services model real institutional variability, not every helper. `Assessment.GradingPolicy` is
  the current example.
- Internal modules import owning leaves directly; callers import the public domain namespace.
- Entity IDs live with their owning domain (`Organization.PersonId`, `Schedule.LessonOccurrenceId`),
  not in a global registry.

The civil-time representation and its bundle trade-off are recorded in
[ADR 0001](./docs/adr/0001-model-civil-time-explicitly.md).

## Compatibility boundary

The mobile application still uses its legacy DTO contract through `@stu/core/compat/mobile-v0`.
That module is intentionally isolated and preserves legacy ambient-date defaults until its consumers
migrate. New code must use the domain modules above.
