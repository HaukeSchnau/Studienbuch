# WebUntis ingestion

This note records the provider boundary observed for IGS Lilienthal and the ingestion decisions that
follow from it. Counts are a point-in-time probe from 2026-08-24, not product invariants.

## Storage contract

`source_import_runs` records every successful poll of one independently reconciled scope. It is a
manifest: provider diagnostics, completeness, root hash, observation count and change counts. It
does not contain a copy of the provider response.

`source_records` owns the current pointer and active state for one provider identity.
`source_record_versions` stores an immutable payload only when that identity presents a new content
hash. `source_changes` records the added, updated, removed and reactivated identities in one run.
An unchanged poll therefore adds one small run and no payload version or change row.

Only a complete scope may interpret an absent identity as removed. Authentication, transport or
decode failures do not create successful runs and cannot mutate current state. A transaction-scoped
advisory lock serializes concurrent imports of the same source, dataset and scope.

This is source truth, not the Studienbuch domain model and not the client sync event log. Domain
projection may combine several source records and emit application changes without weakening
ingestion provenance. Provider corrections belong in the importer. There is no timetable override
model until a concrete user-owned feature needs one.

## IGS directory

The complete 2026/2027 directory (`academic-year:10`) currently contains 1,940 normalized records:

| Kind          | Count |
| ------------- | ----: |
| School        |     1 |
| Academic year |     1 |
| Departments   |     4 |
| Buildings     |     0 |
| Rooms         |   148 |
| Classes       |    45 |
| Teachers      |   125 |
| Students      | 1,287 |
| Activities    |   305 |
| Holidays      |    11 |
| Bell periods  |    13 |

WebUntis calls the 305 subject-like directory records activities. They must remain provider records
until subject and course-offering projection can resolve them. The current data also has eight
classes without a department, twelve classes without a teacher and 221 students without a class;
these are diagnostics, not reasons to reject an otherwise complete import.

The directory is slow-moving. Poll it daily and on demand rather than on the high-frequency
timetable cadence.

The live tenant currently offers four academic years: 2023/2024 (`4`), 2024/2025 (`6`),
2025/2026 (`7`) and 2026/2027 (`10`). Numeric class IDs change every year. The annual names and
teacher history nevertheless show the expected progressions, for example `5.2` (`133`) to `6.2`
(`264`) to `7.2` (`413`) to `8.2` (`565`). Grade-wide resources such as `8`, `9` and `10` are
WebUntis timetable collections, not administrative classes. Resources `12` and `13` represent the
cohort directly because IGS no longer has classes in those grades.

A 2026-08-24 replay of all four live snapshots projected 8,468 normalized source records into
9,564 canonical entities and 3,723 provider links. The result includes 55 lasting classes from 152
annual class records, nine configured cohorts, 1,703 people and 3,705 dated student-class
assignments. The only cohort-name gaps are the three entry years 2024 through 2026.

## IGS timetable

The modern REST endpoint exposes timetable resource views for classes, students, teachers,
subjects and rooms. `STANDARD` already includes substitutions and cancellations; IGS does not need
a second substitution feed.

A complete class-timetable query for 2026-08-24 through 2026-08-28 returned all 45 classes with no
response errors:

| Observation        | Count |
| ------------------ | ----: |
| Class/day rows     |   225 |
| Regular day rows   |   215 |
| No-data day rows   |    10 |
| Entry views        | 1,881 |
| Regular entries    | 1,742 |
| Changed entries    |   116 |
| Cancelled entries  |    20 |
| Additional entries |     3 |

The entries contained 116 removed and 64 added teacher resources, plus five removed and five added
room resources. That is enough to represent teacher substitutions and room changes directly. Notes
and homework are signaled too, but their authored text requires the same privacy treatment as other
school content.

### Raw identity

An entry has a date, a non-empty set of numeric WebUntis IDs, a time range and resource positions.
The same real occurrence is repeated in every affected class view. Grouping only by date and sorted
ID set reduced 1,881 views to 1,115 groups, but 219 groups had legitimately different view payloads
(primarily layout and class-position data), with up to seven views for one occurrence.

The lossless source identity is therefore:

```text
CLASS:<outer class resource id>:<date>:<sorted WebUntis entry ids>
```

It was unique for all 1,881 observed views. The raw payload should also retain the outer day
resource and day status; the entry body alone does not say which resource view produced it.
Projection may later merge views by date and sorted ID set into a domain occurrence. That merge does
not belong in source ingestion.

### Reconciliation scopes

Use one complete scope per academic year, resource type and calendar date:

```text
academic-year:10/resource-type:CLASS/date:2026-08-24
```

The importer may fetch a wider window and class IDs in bounded batches, then normalize and persist
one daily snapshot at a time. A daily scope is complete only when every expected class resource was
requested, every response decoded, no response-level error applies to the date, and duplicate raw
identities agree. Empty complete days are meaningful and remove entries previously observed for
that day. Partial results may be retained for diagnostics but must not remove anything.

Class views are the first imported feed because they cover the school timetable without importing
the same data once per student or exposing a user's personalized menu as school truth. Add teacher,
room or student views when a live comparison proves that they contain data which class views omit,
or when a product query cannot be projected from class views.

### Polling policy

The storage layer does not encode a schedule. The agreed first production policy is configuration
with these defaults:

- directory: daily and on demand;
- timetable from today through 14 days ahead: every 10 minutes;
- timetable from 15 through 56 days ahead: hourly;
- recently elapsed timetable days: refresh for 48 hours, then stop polling;
- exams for the active academic year: hourly.

Add jitter and prevent overlapping executions for one data source. Retry failed provider requests
without advancing current state. Retention can later compact old unchanged run manifests; record
versions and change-bearing runs should remain until their audit and projection requirements are
known.

## IGS exams

The active school year currently exposes 23 exams, all readable by this account. They reference one
exam type, eight subjects, 58 class links, 23 teacher links, 17 room links, 495 student links and 23
invigilator blocks. The statistics endpoint returns the same 23 exams; none has grades yet. Deleted
exams can be requested explicitly with `withDeleted=true` and should be retained as source state.

Exam payloads include student membership and potentially grades. Persist them server-side, but do
not expose raw versions to clients. Projection and authorization must decide which fields a student,
guardian or teacher may receive.

## Domain projection consequences

The current Core schedule is recurrence-first: a `LessonOccurrence` must refer to a
`RecurringMeeting`, and changes are expressed as exceptions. WebUntis gives us authoritative dated
views, including additional periods for which no recurring base necessarily exists. The importer
must not invent recurrence or exceptions merely to satisfy that model.

Keep the raw timetable in source storage first. Before the mobile agenda consumes it, add a narrow
projection that can represent a provider-backed dated occurrence with an optional recurring-meeting
link. Only derive `Cancelled`, `TeacherChanged`, `RoomChanged` or `Rescheduled` exceptions where a
stable recurring base has actually been established. Additional periods remain dated occurrences,
not fabricated recurring meetings.

The legacy Flutter app reduced substitutions to four labels and joined them to a generated agenda
by lesson offset and course. The legacy Expo app stored timetable entries and substitutions in
separate tables keyed by start time and course. Both are useful UI references, but both discard
WebUntis provenance and changes such as simultaneous teacher, room and class-position updates. They
should not constrain the new source or domain model.

### Cohorts and lasting classes

A cohort is a German `Jahrgang`, such as `Paula`. It enters the school in one academic year and
progresses through grade levels. Classes are lasting subdivisions of that cohort: the class shown
as `5.2` in one year normally becomes `6.2` in the next. Students and class teachers may change
without replacing the class identity. The classes end after grade 11 at IGS Lilienthal, while the
cohort continues through grades 12 and 13 without classes.

Core therefore separates `ClassGroup` from `ClassGroupAcademicYear`. The first has the stable
identity and optional cohort link. The second records its academic year, grade, department and
name, such as `5.2`.
WebUntis annual class records link to the stable class through `entity_links`. The IGS profile uses
the school's current convention: for grades 5 through 11, entry year plus subdivision is the stable
identity. Thus `5.2` becomes `6.2`, while a newly appearing `.4` is a new class. We do not model
splits, merges or predecessor graphs without a feature that needs them. This convention lives in a
replaceable school profile because another tenant may assign class identities differently.

Cohort names are explicit IGS configuration, not guessed from WebUntis. The legacy applications
confirm names through entry year 2023 (`Emmy`); later names remain unresolved until configured.
Operational names such as `Paula` are canonical, while namesake metadata is outside the domain.

The legacy Expo importer grouped equal course names when teacher and time also matched, then hashed
the resulting class set into the course ID. That correctly recognizes that one course may span
several classes or cohorts, but makes identity depend on the import window and its observed class
set. Activities therefore remain lossless `ProviderActivity` entities for now. Subject and course
offering projection will get its own evidence-based identity policy rather than inheriting that
unstable hash.

### Provider-backed occurrence projection

Core now models a provider-backed dated occurrence without requiring a recurring meeting, course
offering or bell period. Those domain links are explicit and optional. The occurrence contains a
non-empty set of provider entry IDs and a non-empty set of source claims.

Each class-view claim retains its academic year, outer class, day status, entry location, local
time range, provider type and status, all four resource positions, current and removed resources,
notes, icons, typed texts, lesson and substitution text, and WebUntis presentation fields. Claims
remain separate when class views disagree. The projection does not pick a convenient status or
time and discard the others.

Every claim retains its provider identity. The durable server projection links that claim to the
exact immutable source-record version that produced it. Unknown provider fields remain in the raw
server record rather than leaking into Core as an untyped JSON field. This keeps the provider
boundary explicit while retaining a path back to the complete decoded response.

The WebUntis adapter parses dates and local times through Effect schemas. Invalid provider values
fail in the Effect error channel as `WebUntis.InvalidTimetableOccurrence`; they do not throw from a
pure grouping function or create a partially populated occurrence.

### Durable server projection

`directory_entities` is the current canonical, server-only school directory. Every import replays
all current academic-year scopes together, so stable classes, memberships and cohort progression
can use multi-year evidence. `directory_entity_sources` points each entity to the exact immutable
records supporting it. `directory_projection_runs` references every current source run used by the
replay, and `directory_projection_changes` stores only added, updated, removed or provenance-only
transitions. Repeated imports do not create a new copy of the whole directory.

The canonical projection contains the school, academic years, cohorts, departments, buildings,
rooms, lasting classes and annual class representations, people, school memberships, student class
assignments, class-teacher assignments and department assignments. WebUntis activities are kept as
server-only provider entities until their subject and course identities can be resolved. Raw
holidays and bell periods remain in source storage pending their calendar projections. The import
also writes typed `entity_links`, including the correspondence from each annual WebUntis class ID
to its lasting class or cohort.

`timetable_occurrences` is the current server-side read model. Projection replays one daily source
scope under the same advisory lock used by ingestion, validates every stored payload again, groups
class claims deterministically and reconciles only occurrences in that scope. Empty complete
scopes remove their previous occurrences. Partial source scopes retain records that absence cannot
prove removed, then project the retained current state.

`timetable_occurrence_sources` records the exact immutable source-record versions behind every
current occurrence. A raw version change that does not change the domain payload still refreshes
that provenance. `timetable_projection_runs` and `timetable_projection_changes` record small
per-scope manifests and transitions. They are server audit data, not authorized client events and
not a global generation of school state.

`entity_links` stores typed correspondences between provider identities and stable domain entities.
The timetable projector currently resolves academic-year and outer-class references when those
links exist. A retained source without a link is explicitly unresolved. Inner timetable resources
such as teachers, rooms and subjects do not carry provider IDs in the observed endpoint, so the
projector preserves their names and statuses without guessing an identity.

This boundary follows the useful common ground between Groundswell and LiveStore: PostgreSQL owns
canonical server state, while clients can later rebuild local SQLite state from ordered,
authorized changes. The projection transition log is not that client stream. Authorization,
recipient topics and delivery state belong in the next layer.

## Current implementation

Applying `webuntis-directory` first persists the complete academic-year source snapshot and then
replays all current directory scopes into the canonical projection:

```bash
just console webuntis-directory --school-year 2026/2027 --apply
```

Import the four available school years once to establish the current multi-year directory. Routine
daily imports only need the active year; replay still includes the other current scopes already in
source storage.

The `webuntis-timetable` console command now fetches all class resources in batches of ten, builds
one source snapshot per requested calendar date, and previews without opening PostgreSQL unless
`--apply` is present. Applying a snapshot persists its source records and immediately replays its
daily domain projection:

```bash
just console webuntis-timetable \
  --school-year 2026/2027 \
  --start 2026-08-24 \
  --end 2026-08-28

just console webuntis-timetable \
  --school-year 2026/2027 \
  --start 2026-08-24 \
  --end 2026-08-28 \
  --apply
```

The normalizer requires one decoded row per expected class and date. Missing or duplicate rows,
denied resource statuses, entries without provider IDs, conflicting identities and response errors
make that date partial. A partial date preserves useful additions and updates but cannot remove an
older record.

Two consecutive live imports of the five school days beginning 2026-08-24 proved the storage
behavior in the isolated development database. The first created five changed runs and 1,881 record
versions. The second created five unchanged runs and no versions or changes. Five current daily
scopes point at the unchanged runs.

## Next implementation slice

1. Define role-specific timetable and directory contracts and turn projection transitions into authorized,
   ordered client changes. Keep raw source records and unrestricted projection payloads server-only.
2. Specify stable subject and course-offering identity using live timetable evidence and the useful
   parts of the legacy cross-class grouping behavior.
3. Compare teacher, room and student views against class views with PII-free field and identity
   summaries. Add only the view types that contribute otherwise unavailable data.
4. Add the agreed polling policy with jitter, one active execution per source and observable
   failures that never advance source state.
5. Add the server-only exams importer before designing its role-specific client projection.
