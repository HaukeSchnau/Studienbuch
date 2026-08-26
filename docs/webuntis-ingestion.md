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
advisory lock serializes reconciliation of the same source, dataset and scope. The application also
holds one session-level advisory lock across the provider fetch, source writes and projection for a
school and dataset, so a worker and a manual console import cannot overlap.

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
a second substitution feed. Class, subject, teacher and room views are imported together. Student
views use a separate private dataset and slower schedule. They supply course-roster evidence but do
not become ordinary timetable claims or client timetable data.

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

The live multi-view importer needs one entries request per resource type for IGS. On 2026-08-24 it
covered 45 classes, 305 subjects, 125 teachers and 148 rooms in four responses. All 623 advertised
resource rows were present; the complete daily snapshot contained 1,279 claims: 504 class, 268
subject, 276 teacher and 231 room views.

### Raw identity

An entry has a date, a non-empty set of numeric WebUntis IDs, a time range and resource positions.
The same real occurrence is repeated in every affected resource view. Grouping only by date and
sorted ID set reduced 1,881 class views to 1,115 groups, but 219 groups had legitimately different
view payloads (primarily layout and class-position data), with up to seven class views for one
occurrence.

The lossless source identity is therefore:

```text
<resource type>:<outer resource id>:<date>:<sorted WebUntis entry ids>
```

It was unique for all observed views. The raw payload also retains the outer day
resource and day status; the entry body alone does not say which resource view produced it.
Projection may later merge views by date and sorted ID set into a domain occurrence. That merge does
not belong in source ingestion.

### Reconciliation scopes

Use one complete scope per academic year and calendar date, containing all imported resource types:

```text
academic-year:10/resource-types:CLASS,SUBJECT,TEACHER,ROOM/date:2026-08-24
```

The importer may fetch a wider window and resource IDs in bounded batches, then normalize and
persist one daily snapshot at a time. A daily scope is complete only when every expected resource was
requested, every response decoded, no response-level error applies to the date, and duplicate raw
identities agree. Empty complete days are meaningful and remove entries previously observed for
that day. Partial results may be retained for diagnostics but must not remove anything.

The additional outer views contribute the numeric subject, teacher and room identities that class
entry positions omit. They therefore remain separate source claims even where their display data
overlaps. This costs four entries requests per IGS window because all currently advertised IDs fit
inside the tested batch size of 500.

### Polling policy

The storage layer does not encode a schedule. Managed Development runs one continuous worker per
registered checkout. Production systemd timers invoke bounded Release jobs. Both use these policy
defaults:

- directory: at startup, daily and on demand;
- timetable from two days ago through 14 days ahead: at startup and every 10 minutes;
- timetable from 15 through 56 days ahead: at startup and hourly;
- private course-roster evidence from 28 days ago through 28 days ahead: at startup, daily and
  immediately after a directory projection changes;
- exams for the active academic year: hourly after the exams importer is added.

Every range is clipped to the current WebUntis academic year. The two timetable windows are
disjoint, including when the worker runs near the start or end of an academic year.

Production timers add host-level randomized delay. Each attempt retries twice with jittered
exponential delays starting at five seconds. Exhausted retries are logged and traced. The
continuous worker then waits for its normal next cadence, while a bounded production job exits
non-zero so systemd records the failure. Failed fetches never create a source run or advance current
state.

The directory, timetable and course-roster sources each permit one in-process execution. The hot
and warm timetable loops share the same permit. A PostgreSQL advisory lock keyed by school and
dataset extends this guarantee across worker processes and manual imports. If another process owns
the lock, the attempt is skipped through the same typed failure and retry path. Retention can later
compact old unchanged run manifests; record versions and change-bearing runs should remain until
their audit and projection requirements are known.

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
and the [official 2023 enrollment post](https://igs-lilienthal.de/einschulung-des-jahrgangs-emmy/)
confirm names through entry year 2023 (`Emmy`); later names remain unresolved until configured.
Operational names such as `Paula` are canonical, while namesake metadata is outside the domain.

The legacy Expo importer grouped equal course names when teacher and time also matched, then hashed
the resulting class set into the course ID. That correctly recognizes that one course may span
several classes or cohorts, but makes identity depend on the import window and its observed class
set.

The four-week live comparison makes the provider boundary more precise. Numeric subject-resource
IDs identify activities, not courses. Only 154 of the 305 directory activities appeared in 5,648
dated occurrences. Generic activities such as `IGL`, `Präsenz` and `WPK` apply across many
independent groups. Conversely, none of 9,937 individual entry IDs recurred on another date.
Subject-view claims therefore preserve activity identity, but neither activity IDs nor dated entry
IDs become course IDs.

Course identity is stable and opaque. A semester or academic-year boundary does not replace it.
Core mirrors lasting classes: `CourseOffering` owns the durable identity, while a
`CourseOfferingAcademicYear` record holds that year's name, subject resolution and participating
cohorts and classes. Positive evidence may connect adjacent annual records; the boundary itself
proves neither continuity nor separation. Unresolved provider observations do not receive a durable
course ID.

The first experimental projector grouped one activity's occurrences by connected class overlap and
used teachers for classless entries. Its four-week result contained 743 candidates. The live
identity audit disproved the grouping invariant, so those candidates are diagnostic output only and
must not be persisted. One shared class can connect distinct level groups, and a generic activity
can create a transitive component across otherwise unrelated courses.

### Course identity audit

`webuntis-course-audit` reconstructs provider occurrences and reports evidence without resolving or
persisting course identity. It separates regular teaching from cancellations, additions and other
operational events. Output examples are bounded and contain provider IDs rather than teacher names.
The report is deterministic under reordered periods and observations.

The 2026-08-24 through 2026-09-20 audit found:

| Evidence                                                              |     Count |
| --------------------------------------------------------------------- | --------: |
| Provider-backed occurrences                                           |     5,648 |
| Resource-view claims                                                  |    22,425 |
| Occurrences with all four imported views                              |     3,534 |
| Occurrences without an activity claim                                 |       504 |
| Occurrences with several activity claims                              |         0 |
| Occurrences whose views disagree on time, type or status              |         0 |
| Annual provider activities observed                                   |       154 |
| Different activities with a shared name and lasting class             | 184 pairs |
| Activities with more than one exact class signature                   |        82 |
| Activities containing a one-class overlap between signatures          |         9 |
| Activities whose overlap graph transitively joins disjoint signatures |         2 |
| Overlapping occurrence pairs for one teacher                          |        49 |
| Overlapping teacher pairs with the same activity                      |        42 |
| Overlapping teacher pairs with different activities                   |         7 |
| Overlapping occurrence pairs for one room                             |       197 |

These observations support a narrower physical invariant. One teacher cannot perform two
independent teaching events at the same time, so overlapping rows identify a joint event candidate
or invalid provider data. They do not prove permanent course equality. WebUntis assigns distinct
entry IDs to these rows, including seven teacher overlaps with different activities. One dated
occurrence may therefore link several durable courses.

The audit treats these as hard requirements for the reconciler:

- teacher, room, timetable slot, semester and academic year are not identity;
- student and class membership are evidence, not identity;
- one shared class cannot merge courses;
- exceptional occurrences cannot redefine regular course structure;
- conflicting strong evidence remains unresolved;
- reconciliation is deterministic and independent of import order;
- missing observations do not prove a split or removal;
- every automatic decision retains its source evidence.

The adjacent 2025/2026 and 2026/2027 audit covered 11,031 dated occurrences and 44,128 resource-view
claims. It found 582 possible cross-year activity matches, 157 of which competed with another match.
Provider activity, name, class and teacher evidence therefore cannot resolve cross-year identity by
themselves.

### Student-view roster evidence

Student timetable views add information that class, subject, teacher and room views do not provide:
the planned student roster of each dated entry. This is server-only identity evidence, not a reason
to duplicate every student's timetable into ordinary client projections.

A four-week 2026/2027 probe of regular `MA-E`, `MA-G` and `MA23` teaching found 1,893 student-entry
claims for 99 dated events. Those events had only 14 distinct rosters. Twelve rosters recurred on
several dates, usually seven to eleven times. The exact rosters distinguish parallel level courses
whose class signatures overlap and whose activity or teacher evidence is identical.

The adjacent-year comparison found four `MA-E` groups whose roster overlap remained between 0.769
and 0.880 as their classes advanced from grade 9 to grade 10. One retained 20 of 22 observed
students despite a teacher change. This is direct evidence that annual course continuity can survive
changes to teacher, timetable slots and class labels.

`MA23` demonstrates the cross-cohort case. In 2025/2026 WebUntis emitted two distinct regular rows at
the same time with the same teacher and activity, one labelled for grade 12 and one for grade 13.
The two rows carried rosters of eight and seven students and recurred together twelve times. In
2026/2027, six students from the former grade-12 roster appeared in the seven-student successor
roster. The name is useful IGS-specific evidence, but is not sufficient on its own.

Course reconciliation should therefore work in two stages:

1. Build regular annual course observations from repeated dated roster observations. Exact repeated
   rosters are strong evidence. Near-equal rosters remain compatible because students can join or
   leave. Provider activity, normalized label, class participation and teacher assignment support
   the decision but never determine it alone.
2. Reconcile annual observations across years. Compare student rosters within their cohort or class
   progression, so a graduating grade-13 partition does not count against the continuation of the
   grade-12 partition. Require a unique compatible match and corroborating school-specific evidence.
   Weak or competing matches remain unresolved.

Repeated simultaneous rows need a separate event rule. The same teacher cannot teach independent
events at the same instant. When rows with a compatible IGS course code recur together throughout
regular teaching, their roster partitions may belong to one course, as with `MA23`. An occasional
joint lesson instead links its dated event to several existing courses and does not merge them.

There should be no universal roster-overlap threshold. The reconciler records counts and overlap as
evidence, while the school profile decides which combinations are strong enough. IGS naming rules
may recognize codes such as `MA23`; generic level labels such as `MA-E` and `MA-G` classify a course
but do not identify one.

Student views should use a separate, slower server-only import scope. Course rosters change far less
often than substitutions, and importing every student claim every ten minutes would add substantial
private data without improving the client timetable. A daily reconciliation window, plus a refresh
after directory changes, is the current default.

Student entry requests combine at most 500 students with three calendar dates. The daily source
scopes merge those responses after all batches return. This keeps the roster window intact without
asking WebUntis to calculate every student's whole window in one request.

The private source scope is one complete academic year and date:

```text
academic-year:10/resource-type:STUDENT/date:2026-08-24
```

It expects one decoded row per advertised student. Missing rows, duplicate rows, denied access,
response errors and conflicting raw identities make the date partial. The raw record retains the
student filter item, including dated class assignments and fields that the provider may add to its
assignment groups. Preview and reconciliation diagnostics contain counts and provider IDs, never
student names.

The live 2026-08-24 preview fetched 1,282 students in three batches. WebUntis returned every
expected student row with no response errors, producing 5,212 private occurrence views and one
complete daily scope.

Projection groups student views by date and sorted provider entry IDs. It removes names while
retaining student provider IDs, dated class assignments, IGS class or cohort progression keys,
course codes and corroborating activity, teacher and class IDs from the ordinary timetable view.
The result remains server-only.

The first IGS reconciliation policy requires three regular observations before a roster becomes an
annual course observation. It may combine two disjoint roster partitions only when a code ending in
`23` recurs at least three times with the same teacher and time. This is the observed `MA23`
convention. `MA-E` and `MA-G` do not satisfy that rule, so parallel level groups remain separate even
when they share a teacher, activity, class or timetable slot. One-off joint lessons remain dated
evidence and cannot create an annual merge.

Adjacent-year comparison measures roster continuity only across shared stable class or cohort
keys. This prevents a graduating grade-13 partition from weakening the continuing grade-12 part of
`MA23`. The IGS v1 rule treats at least three shared students, two-thirds Jaccard overlap and
two-thirds retention on both sides as strong roster evidence. Those numbers belong to the school
profile, not the generic reconciler.

Every pair receives a schema-backed `Same`, `Different`, `Compatible` or `Ambiguous` decision.
`Same` requires strong roster progression, course-code or activity corroboration, and a unique
match in both directions. Competing strong matches are `Ambiguous`. The decision records the rule
version, observation IDs, overlap counts and corroborating provider IDs.

The durable projector replays every current private roster scope for one data source in one
transaction. A mature unique component receives one random UUID. An exact observation keeps its
stored UUID, and every uniquely connected `Same` observation reuses it in either chronological
direction. A same-year observation that shares students and compatible course evidence with
another pattern remains unresolved, as do missing course codes and components that already contain
conflicting stored identities. Import order therefore cannot independently allocate two IDs to an
adjacent-year `Same` pair.

Annual observations retain their private payload and exact raw source-record versions. Current
`Same`, `Compatible` and `Ambiguous` decisions retain their name-free evidence. `Different` pairs
are counted but not stored because they carry no resolution or ambiguity and dominate the Cartesian
comparison. Permanent offerings and their school-year representations are separate from provider
observations. Missing observations become inactive but do not delete an offering or prove that it
ended.

Resolved dated observations create a durable occurrence-to-offering overlay. The projector updates
the current occurrence payload, while the ordinary timetable projector reapplies the overlay on
every later source refresh. An unchanged course replay writes only its run and source manifest; it
does not allocate another UUID or rewrite evidence.

The live two-year private replay covered four weeks in both 2025/26 and 2026/27. It read 187,970
student occurrence views, reconstructed 8,469 dated rosters and accepted 1,092 annual observations,
including nine repeated `*23` joint observations. The resolution produced 39 unique `Same`
decisions, 929 new-identity plans and 128 unresolved annual observations. It also classified 2,452
ambiguous and 23,909 compatible adjacent-year pairs, so retaining uncertainty is a material part of
the design rather than an edge case.

The historical audit also found seven older entries with `position1: null`.
`@schnau/webuntis-api` 0.2.3 accepts that shape, and source normalization retains the distinction
between `null` and an empty position array. The provider connection recovered and the adjacent-year audit
completed; a broader four-year comparison is not required for the current model.

### Provider-backed occurrence projection

Core now models a provider-backed dated occurrence without requiring a recurring meeting, course
offering or bell period. Those domain links are explicit and optional. The occurrence contains a
non-empty set of provider entry IDs and a non-empty set of source claims.

Each resource-view claim retains its academic year, outer resource, day status, entry location,
local time range, provider type and status, supplied resource positions, current and removed
resources, notes, icons, typed texts, lesson and substitution text, and WebUntis presentation
fields. Claims remain separate when views disagree. The projection does not pick a convenient
status or time and discard the others. Raw source records retain whether each provider position was
`null`, empty or populated.

Subject, teacher and room claims carry their real provider identities and resolve through typed
entity links where a domain entity exists. The live API uses `null`, not an empty string, for some
teacher- and room-view notes, lesson text and substitution text. `@schnau/webuntis-api` 0.2.3 and
Core both preserve that distinction.

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
all resource claims deterministically and reconciles only occurrences in that scope. Empty complete
scopes remove their previous occurrences. Partial source scopes retain records that absence cannot
prove removed, then project the retained current state.

`timetable_occurrence_sources` records the exact immutable source-record versions behind every
current occurrence. A raw version change that does not change the domain payload still refreshes
that provenance. `timetable_projection_runs` and `timetable_projection_changes` record small
per-scope manifests and transitions. They are server audit data, not authorized client events and
not a global generation of school state.

`entity_links` stores typed correspondences between provider identities and stable domain entities.
The timetable projector resolves academic-year, class, teacher and room references when those
links exist. Subject claims retain their provider source while canonical subject resolution remains
pending. Inner position resources still do not carry provider IDs, so their names and statuses are
preserved without guessing; the matching outer claims carry the authoritative identity.

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

The `webuntis-timetable` console command fetches class, subject, teacher and room views in batches
of up to 500, builds one source snapshot per requested calendar date, and previews without opening
PostgreSQL unless `--apply` is present. Applying a snapshot persists its source records and
immediately replays its daily domain projection:

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

The normalizer requires one decoded row per expected resource and date. Missing or duplicate rows,
denied resource statuses, entries without provider IDs, conflicting identities and response errors
make that date partial. A partial date preserves useful additions and updates but cannot remove an
older record.

Run an identity audit over one or several periods without opening PostgreSQL:

```bash
just console webuntis-course-audit \
  --range 2025/2026,2025-09-01,2025-09-28 \
  --range 2026/2027,2026-08-24,2026-09-20
```

Fetch the private student view for a bounded reconciliation window. The default command prints only
the name-free preview. `--apply` persists the daily raw scopes and then replays all current roster
years into the durable course projection. Import the matching directory and ordinary timetable
scopes first so annual representations and dated occurrence links can be created:

```bash
just console webuntis-course-rosters \
  --school-year 2026/2027 \
  --start 2026-08-24 \
  --end 2026-09-20

just console webuntis-course-rosters \
  --school-year 2026/2027 \
  --start 2026-08-24 \
  --end 2026-09-20 \
  --apply
```

Run the continuous importer as a dedicated process:

```bash
just dev worker
```

It requires `DATABASE_URL` and the same `WEBUNTIS_*` configuration as the manual commands. It runs
the directory, both timetable windows and the private course-roster window immediately before
entering their independent schedules. Its structured logs and spans use the
`studienbuch-worker` service identity.

The worker is a separate application rather than a background fiber in the web server. Web request
lifecycle, replica count and restarts therefore cannot silently multiply or terminate import loops.
Managed Development starts one worker for every registered checkout. Production runs the four
bounded Release jobs through the host timers described above.

## Next implementation slice

1. Define role-specific timetable, directory and course contracts and turn projection transitions into
   authorized, ordered client changes. Keep raw source records and unrestricted projection payloads
   server-only.
2. Add student timetable data to client contracts only if a concrete feature needs it. Course
   reconciliation alone does not justify duplicating the school timetable per student.
3. Add the server-only exams importer before designing its role-specific client projection, then
   attach it to the worker's hourly cadence.
