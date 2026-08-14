# Open a course from the weekly schedule

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A course displayed in the weekly schedule links to that course's detail for the current semester.

## Example

Given the current week contains a seeded Mathematics course
When the student opens Mathematics from the schedule
Then the Mathematics course detail is shown
And the current semester identifies the displayed course context

## Evidence contract

| Outcome                                                             | Executable evidence                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `SCHEDULE_COURSE_ACTIONABLE` — the seeded course can be opened      | The Mathematics schedule entry exposes its course destination action       |
| `COURSE_DESTINATION_REACHED` — the correct course opens             | `course-screen` is visible with the Mathematics heading and seeded teacher |
| `CURRENT_SEMESTER_CONTEXT_VISIBLE` — the detail is scoped correctly | The current semester name is visible on `course-screen`                    |

## State

Initial state: A configured student with a completed tutorial is viewing a current week containing Mathematics
Final state: Mathematics course detail for the current semester is open
Side effects: Navigation state only

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_entry.dart:72`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/course.dart:136`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/courses/course_page.dart:43`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
