# Register an absence for scheduled courses

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Absence registration derives its course choices from the selected date, initially includes every
scheduled course, and stores one absence entry for each course the student leaves selected.

## Example

Given a minor has three scheduled courses on a fixed date and no absences
When the student excludes one course, enters a reason, saves, and relaunches the app offline
Then one related absence group shows the reason and the two selected courses
And the excluded course has no absence entry

## Evidence contract

| Outcome                         | Executable evidence                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| Scheduled courses are proposed  | `absence-course-list` initially shows all three seeded courses selected                     |
| Only retained choices are saved | The created absence group names the two selected courses and excludes the deselected course |
| The absence is durable offline  | The same group is visible after an offline process restart                                  |

## State

Initial state: A configured minor has three courses on a fixed date, no absences, and networking online
Final state: Two unexcused absence entries share the fixed date and reason and remain available offline
Side effects: Remove both created absence entries when restoring the fixture

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:18`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:22`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:25`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:93`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absences_page.dart:25`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
