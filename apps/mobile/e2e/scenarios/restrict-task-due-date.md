# Restrict task due dates

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A new task's due date can be today or a future date within one year, but it cannot be placed before
today or beyond the supported planning horizon.

## Example

Given task creation is open on a fixed current date
When the student opens the due-date picker
Then dates before today and more than one year ahead are unavailable
And today and the date one year ahead are available

## Evidence contract

| Outcome                               | Executable evidence                                              |
| ------------------------------------- | ---------------------------------------------------------------- |
| Past due dates are excluded           | The fixed day before today is disabled in `task-due-date-picker` |
| The supported range is inclusive      | Today and the fixed date 365 days ahead are enabled              |
| Dates beyond the horizon are excluded | The fixed date 366 days ahead is unavailable or disabled         |

## State

Initial state: Task creation is open with no due date and the device clock is fixed
Final state: Task creation remains open with no task saved
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:33`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:35`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
