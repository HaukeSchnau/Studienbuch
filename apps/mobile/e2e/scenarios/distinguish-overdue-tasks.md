# Distinguish overdue tasks

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An incomplete task whose due date has passed is visibly distinguished from incomplete future work.

## Example

Given one incomplete task is overdue and another incomplete task is due in the future
When the student opens the task overview
Then the overdue task's due date is presented as overdue
And the future task is not presented as overdue

## Evidence contract

| Outcome                      | Executable evidence                                                             |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Overdue work is explicit     | `overdue-task-card` exposes the seeded past date with overdue styling and state |
| Future work is discriminated | `future-task-card` exposes the seeded future date without overdue state         |

## State

Initial state: A configured student has two incomplete tasks around a fixed current date
Final state: Task data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/tasks_view.dart:54`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/tasks_view.dart:90`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
