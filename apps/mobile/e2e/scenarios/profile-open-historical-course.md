# Open a course in its historical semester

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Opening a course from an earlier semester preserves that semester's identity and grade history and
does not offer current homework actions.

## Example

Given a previous semester contains a seeded History course with confirmed grades
When the student opens History from that semester
Then the History course detail identifies the previous semester and its grades
And current-semester homework actions are absent

## Evidence contract

| Outcome                                                                               | Executable evidence                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `HISTORICAL_COURSE_REACHED` — the correct course opens                                | `course-screen` shows the History heading and seeded teacher             |
| `HISTORICAL_SEMESTER_VISIBLE` — the selected semester is preserved                    | The previous semester name and date range are visible on `course-screen` |
| `HISTORICAL_GRADES_VISIBLE` — stored academic history is available                    | The seeded confirmed total, oral, and written grade evidence is visible  |
| `CURRENT_HOMEWORK_ACTIONS_ABSENT` — historical detail is not editable as current work | `course-homework-panel` and `add-course-task` are hidden                 |

## State

Initial state: A configured student is viewing a previous semester containing seeded History grades
Final state: Historical History course detail is open and data is unchanged
Side effects: Navigation state only

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/subjects_grid.dart:136`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/courses/course_page.dart:20`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/courses/course_page.dart:117`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
