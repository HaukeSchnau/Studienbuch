# Group related absences for parent confirmation

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Unconfirmed absences recorded with the same date and reason are presented to a parent as one group
covering all affected courses.

## Example

Given a minor has two parent-unconfirmed absence entries with the same date and reason
When the student opens unexcused absences
Then one absence group shows the shared date and reason
And the group names both affected courses without duplicating the parent action

## Evidence contract

| Outcome                        | Executable evidence                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| Related entries form one group | `unexcused-absence-list` contains exactly one seeded parent-confirmation group        |
| The group identifies its scope | `seeded-absence-group` contains the shared date, shared reason, and both course names |
| Confirmation is not duplicated | `seeded-absence-group` exposes one `excuse-absence-button`                            |

## State

Initial state: A configured minor has exactly two parent-unconfirmed absences sharing a date and reason
Final state: Absence data and confirmation state are unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absences_page.dart:22`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absences_page.dart:25`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:96`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:125`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
