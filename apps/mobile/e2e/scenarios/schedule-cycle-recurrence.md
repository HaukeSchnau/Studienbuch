# Set a course's A/B-week recurrence

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

While correcting the timetable, the student can choose whether a course occurs every week, only
in A weeks, or only in B weeks, and the chosen recurrence is visible on the course.

## Example

Given a timetable course currently occurs every week
When the student changes its recurrence to A week and then B week
Then the course first exposes an A badge and then a B badge
And the final B-week recurrence remains after reopening My Week

## Evidence contract

| Outcome                                                       | Executable evidence                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `EVERY_WEEK_BASELINE` — the initial recurrence is established | The seeded course exposes `every-week` recurrence and no A/B badge                          |
| `A_WEEK_SELECTED` — the first change is visible               | The seeded course exposes `a-week` recurrence and an `A` badge                              |
| `B_WEEK_SELECTED` — the second change is discriminating       | The seeded course exposes `b-week` recurrence and a `B` badge while the `A` badge is absent |
| `B_WEEK_PERSISTED` — recurrence survives navigation           | After leaving and reopening My Week, the seeded course still exposes `b-week` recurrence    |

## State

Initial state: A configured student with a completed tutorial has one every-week course in a deterministic timetable slot
Final state: The seeded course occurs only in B weeks
Side effects: The fixture must restore the course to every-week recurrence before another independent run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_entry.dart:90`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_entry.dart:154`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_entry.dart:220`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
