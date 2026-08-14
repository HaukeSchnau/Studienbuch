# Review courses from another semester

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A student with more than one relevant semester can switch between them and see each semester's own
courses and grade summary, with the newest semester selected initially.

## Example

Given the student has distinct courses in a previous and current semester
When the student opens My Profile and selects the previous semester
Then the previous semester is selected
And only its seeded courses and semester average are shown

## Evidence contract

| Outcome                                                                        | Executable evidence                                                         |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `CURRENT_SEMESTER_SELECTED_INITIALLY` — the newest semester is the baseline    | The current-semester tab is selected with its seeded course visible         |
| `PREVIOUS_SEMESTER_SELECTED` — the requested semester is active                | The previous-semester tab exposes its selected state                        |
| `PREVIOUS_SEMESTER_CONTENT_VISIBLE` — content belongs to the selected semester | The previous semester's seeded course and `Semesterschnitt` are visible     |
| `CURRENT_SEMESTER_CONTENT_REPLACED` — semester data is not mixed               | The current-only seeded course is absent from the selected semester content |

## State

Initial state: A configured student has two deterministic relevant semesters with distinct course sets and confirmed grades
Final state: The previous semester is selected and data is unchanged
Side effects: Navigation state only

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/profile_page.dart:16`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/profile_page.dart:32`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/subjects_grid.dart:86`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
