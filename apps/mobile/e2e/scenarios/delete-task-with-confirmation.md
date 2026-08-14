# Delete a task only after confirmation

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Task deletion requires explicit confirmation; cancelling preserves the task, while confirming removes
it from durable task data.

## Example

Given one task exists and its details are open
When the student cancels deletion, reopens deletion, and confirms it
Then cancellation preserves the task and its details
And confirmation removes the task from the complete task collection after relaunch

## Evidence contract

| Outcome                              | Executable evidence                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Deletion is guarded                  | `delete-task-dialog` shows `Abbrechen` and `Löschen` actions                                       |
| Cancellation preserves durable state | Reopening task details after cancellation shows the seeded task title                              |
| Confirmation removes durable state   | The settled task collection's seeded count decreases and the seeded title is absent after relaunch |
| The detail destination closes        | `task-list-screen` is visible and `task-detail-screen` is hidden after confirmation                |

## State

Initial state: A configured student has exactly one seeded task and its detail screen is open
Final state: The seeded task no longer exists
Side effects: Restore the seeded task before another run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/task_page.dart:166`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/task_page.dart:176`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/task_page.dart:188`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
