# `@stu/core`

`@stu/core` is Studienbuch's runtime-independent school-life domain. It owns validated
vocabulary, invariants, deterministic projections, and composable workflows. It does not own
React, persistence, synchronization transports, database rows, or provider-specific payloads.

The canonical language is recorded in [CONTEXT.md](./CONTEXT.md).

## Module interface

The package root exports shared primitives and domain namespaces. Each domain is also an explicit
subpath for focused imports:

```ts
import { CalendarDate, Schedule } from "@stu/core";
import * as Attendance from "@stu/core/attendance";
```

- `academics`: schools, subject catalogs, terms, cohorts, class groups, offerings, enrollments,
  and course choices
- `people`: contextual memberships, guardian relationships, teaching assignments,
  acknowledgements, and authority decisions
- `schedule`: academic calendars, recurring meetings, dated occurrences, exceptions, and
  collision detection
- `attendance`: absence cases and independently resolved missed lessons
- `assessment`: written assessments, revisable course standings, independent attestations, and grading
  policy
- `tasks`: task lifecycle, due-state, visibility, and deterministic selection
- `provenance`: sourced values, overrides, subject resolution, and import reconciliation

## Construction and decoding

Public boundary values are Effect schemas. Decode untrusted input and use `.make` only after the
caller has established that construction is trusted:

```ts
import { Schema } from "effect";
import { CalendarDate } from "@stu/core";

const decoded = Schema.decodeUnknownEffect(CalendarDate)("2026-08-14");
const trusted = CalendarDate.make("2026-08-14");
```

Civil school dates and local lesson times are deliberately not represented as JavaScript `Date`. Absolute
audit timestamps use Effect's UTC date-time value. All new domain functions receive the relevant date
explicitly; replay and projections never consult an ambient clock.

## Effect usage

Pure calculations remain ordinary functions. Operations use `Effect` when callers benefit from
typed refusal or when an institutional policy is a genuine runtime dependency. Policy layers are
configuration, not service-locator wrappers around arithmetic.

The current mobile application still uses its old DTOs through
`@stu/core/compat/mobile-v0`. That module is intentionally isolated and carries its own removal
condition; it preserves the legacy ambient-date defaults until its consumers migrate. New code
must use the domain modules.
