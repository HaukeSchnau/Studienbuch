# Add a course to the timetable

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

While correcting the timetable, the student can add one of their courses to a valid weekday and
lesson start, initially scheduled for both A and B weeks.

## Example

Given the seeded Biology course is available but absent from the timetable
When the student adds Biology to Wednesday's third lesson
Then Biology appears in Wednesday's third lesson
And it is scheduled for both A and B weeks

## Evidence contract

| Outcome                                                                  | Executable evidence                                                                    |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `COURSE_AVAILABLE_TO_ADD` — the starting course choice exists            | Biology is visible within `schedule-course-choices` and absent from the timetable grid |
| `COURSE_ADDED_TO_SLOT` — the new entry is in the requested location      | Wednesday's third lesson contains Biology                                              |
| `COURSE_DEFAULTS_TO_EVERY_WEEK` — recurrence has a deterministic default | The new Biology entry exposes `every-week` recurrence and no A/B-only badge            |
| `ADDED_COURSE_PERSISTED` — the new entry survives navigation             | After leaving and reopening My Week, Wednesday's third lesson still contains Biology   |

## State

Initial state: A configured student with a completed tutorial has Biology selected as a course but absent from the timetable
Final state: Biology occupies Wednesday's third lesson in both A and B weeks
Side effects: The fixture must remove the added Biology entry before another independent run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/course_choices_row.dart:21`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/new_course_time_drag_target.dart:38`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/new_course_time_drag_target.dart:60`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
