# Studienbuch Core

Studienbuch Core describes school life independently of persistence, synchronization, transport, and user interface concerns.

## Shared values

**Calendar date**:
A timezone-free ISO calendar day such as 2026-08-15, represented directly by Temporal `PlainDate.Record`. It has no clock time or UTC offset and is encoded as `YYYY-MM-DD` at external boundaries.
_Avoid_: JavaScript `Date`, timestamp, date string

**Calendar-date range**:
A closed range of calendar dates whose start and end dates are both included.
_Avoid_: Date interval, when that could imply instants or times

**Local time**:
A wall-clock position within one day, represented with millisecond precision and no date, timezone, or UTC offset.
_Avoid_: Duration, timestamp, minutes

**Local-time range**:
A half-open range of local times that includes its start and excludes its end.
_Avoid_: Duration, bell period when no period identity is present

**Aggregate revision**:
A monotonic version used to detect concurrent changes to one domain aggregate.
_Avoid_: Source revision, timestamp, global version

**Non-blank text**:
User- or provider-authored text that contains at least one non-whitespace character; its original spacing is preserved.
_Avoid_: Identifier, normalized label

## Academic structure

**School directory**:
A school-scoped snapshot of terms, cohorts, class groups, course offerings, choices, and enrollment facts used to validate their relationships as a whole.
_Avoid_: Academic structure, school configuration

**Subject**:
A school-scoped catalog entry such as Mathematics or Informatics.
_Avoid_: Hard-coded subject code, course

**Course offering**:
A concrete teaching of one subject during an academic term.
_Avoid_: Course, subject

**Enrollment**:
A student's participation in a course offering for an effective interval.
_Avoid_: Selected course

**Course choice group**:
A set of alternative course offerings governed by an explicit selection cardinality.
_Avoid_: Choosable subject

**Cohort**:
A group of students whose grade-level progression is calculated together.
_Avoid_: Year

**Class group**:
An administrative or tutor grouping such as 8b.
_Avoid_: Class

**Academic term**:
A school-defined, closed interval of academic dates.
_Avoid_: Semester when the institution does not use semesters

## Scheduling

**Academic calendar**:
The school-day policy formed by academic terms, enabled weekdays, and calendar closures.
_Avoid_: Calendar when the school-day rules are meant

**School day**:
A date within an academic term, on an enabled weekday, and outside every calendar closure.
_Avoid_: Weekday, working day

**Calendar closure**:
A closed range of dates on which ordinary school activity is suspended.
_Avoid_: Holiday when the closure may have another cause

**Bell schedule**:
The set of named bell periods that applies to a school for a range of dates.
_Avoid_: Timetable

**Bell period**:
A named, half-open range of local wall-clock time; it does not by itself represent a lesson.
_Avoid_: Lesson, duration

**Recurring meeting**:
A rule that places a course offering at a local time on matching school dates.
_Avoid_: Timetable entry

**Lesson occurrence**:
A dated realization of a recurring meeting with both its originally scheduled identity and its effective date, time, teacher, and room.
_Avoid_: Recurring lesson

**Schedule exception**:
A dated cancellation, rescheduling, substitution, or detail change applied to a lesson occurrence.
_Avoid_: Timetable mutation

## Attendance

**Absence case**:
One student's reported absence on one date, containing one or more missed lessons.
_Avoid_: Absence row

**Missed lesson**:
One lesson within an absence case whose teacher decision is tracked independently.
_Avoid_: Course absence

**Acknowledgement**:
Evidence that an authorized actor accepted or confirmed a specific revision of a domain fact.
_Avoid_: Signature, confirmation boolean

**Legal-age policy**:
The age of majority and the explicit non-leap-year anniversary convention used to evaluate a person's legal status on a calendar date.
_Avoid_: A hard-coded birthday calculation

**Evidence artifact**:
An immutable content reference attached as supporting evidence; the content itself is managed outside Core.
_Avoid_: File when referring only to its domain reference

## Assessment

**Written assessment**:
An independently dated and named assessment result.
_Avoid_: Written grade row

**Course standing**:
A revisable oral or overall estimate for a course offering.
_Avoid_: Master grade, current grade

**Standing revision**:
One immutable observation in a course standing's history.
_Avoid_: Edited grade

**Teacher attestation**:
Evidence that an authorized teacher accepts an assessment result as the school's recorded fact.
_Avoid_: Teacher confirmation boolean

**Learner acknowledgement**:
Evidence that the adult learner or an authorized guardian has seen and accepted the recorded result.
_Avoid_: Parent confirmation boolean

## Tasks

**School task**:
A student's actionable item, optionally related to a course offering.
_Avoid_: Homework when the item may represent other work

## Imported data

**Source stamp**:
The provider identity, source revision, external identity, and observation time attached to imported information.
_Avoid_: Sync metadata

**Source observation**:
One provider record as observed during an import, together with its source stamp and raw value.
_Avoid_: Authoritative domain fact

**Source revision**:
A provider sequence used to order observations of one external record within one data source.
_Avoid_: Aggregate revision, global version

**External identifier**:
An identity assigned to a record by another system and interpreted only within its data source.
_Avoid_: Domain identifier

**Entity link**:
A persistent correspondence from a provider-scoped external identity to an internal subject or course-offering identity. Several providers may identify the same internal entity.
_Avoid_: Storing provider identifiers on organization entities

**Override**:
An explicit user-owned replacement for a sourced value that remains until relinquished.
_Avoid_: Manually edited flag
