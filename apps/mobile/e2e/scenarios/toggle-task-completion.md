# Toggle task completion

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A student can mark a task complete and later restore it to open; each state is durable and visibly
distinguishable from the other.

## Example

Given an open task exists
When the student marks it complete, relaunches the app, and then restores it to open
Then completion remains visible after relaunch
And the restored task is visibly open again

## Evidence contract

| Outcome                      | Executable evidence                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| The initial state is open    | `task-open-status` is visible and `task-complete-status` is hidden                                                |
| Completion persists          | `task-complete-status` and `restore-task-button` are visible after relaunch                                       |
| The inverse state is removed | `task-open-status` is hidden while the task is complete                                                           |
| Restoration is explicit      | `task-open-status` and `complete-task-button` are visible after restoring, while `task-complete-status` is hidden |

## State

Initial state: A configured student has one open task and networking does not matter
Final state: The task is restored to open
Side effects: None; the scenario restores its starting state

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/task_page.dart:44`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/task_page.dart:69`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/task_page.dart:78`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
