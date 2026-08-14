# Delete an absence group only after confirmation

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Deleting a displayed absence group requires explicit confirmation; cancelling preserves every entry,
while confirming removes every course absence represented by the group.

## Example

Given one displayed absence group represents two course absences
When the student cancels deletion, reopens deletion, and confirms it
Then cancellation preserves the complete group
And confirmation removes both entries from the durable absence collection

## Evidence contract

| Outcome                              | Executable evidence                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Deletion is guarded                  | `delete-absence-dialog` shows `Abbrechen` and `Löschen` actions                                |
| Cancellation preserves the group     | `seeded-absence-group` still shows both course names after cancelling                          |
| Confirmation removes the whole group | The settled absence count decreases by two and `seeded-absence-group` is absent after relaunch |

## State

Initial state: A configured minor has exactly two related absence entries presented as one group
Final state: Neither seeded absence entry exists
Side effects: Restore both absence entries before another run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:25`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:42`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absences_page.dart:25`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
