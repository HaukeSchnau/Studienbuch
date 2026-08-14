# Studienbuch Core

Studienbuch Core describes school life independently of persistence, synchronization, transport, and user interface concerns.

## Academic structure

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

**Recurring meeting**:
A rule that places a course offering at a local time on matching school dates.
_Avoid_: Timetable entry

**Lesson occurrence**:
The dated realization of a recurring meeting.
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

**Override**:
An explicit user-owned replacement for a sourced value that remains until relinquished.
_Avoid_: Manually edited flag
