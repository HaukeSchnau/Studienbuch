# Advance Overview to the next relevant school day

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

When no lessons remain today, Overview presents the next relevant school day instead of an empty,
finished agenda.

## Example

Given today's final lesson has ended and the next school day has one course
When the student opens Overview
Then the next school day is identified
And its upcoming course is shown

## Evidence contract

| Outcome                                                                   | Executable evidence                                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `NEXT_SCHOOL_DAY_IDENTIFIED` — the agenda advances beyond today           | `overview-agenda` shows the seeded next-school-day relative label       |
| `NEXT_SCHOOL_DAY_COURSE_VISIBLE` — the future agenda is populated         | The seeded next-school-day course is visible within `overview-agenda`   |
| `FINISHED_DAY_NOT_PRESENTED` — the completed day is not the active agenda | The seeded completed course from today is absent from `overview-agenda` |

## State

Initial state: A configured student has no remaining lessons today, one course on the next weekday, no holiday, and a frozen post-school time
Final state: Timetable data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda.dart:35`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda.dart:94`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda.dart:140`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
