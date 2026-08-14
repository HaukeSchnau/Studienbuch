# Order tasks by status and due date

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Open tasks appear before completed tasks, and tasks within each state are ordered by nearest due date.

## Example

Given tasks exist with distinct completion states and due dates
When the student opens the task overview
Then open tasks appear before completed tasks
And earlier due dates appear before later due dates within each state

## Evidence contract

| Outcome                         | Executable evidence                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Open work has priority          | `task-list` exposes the seeded open tasks before the seeded completed task         |
| Due-date order is deterministic | Within the open-task group, the earlier seeded task precedes the later seeded task |
| Completed work remains visible  | `task-list` contains the completed task after all open tasks                       |

## State

Initial state: A configured student has two open tasks and one completed task with fixed distinct due dates
Final state: Task data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/tasks_overview.dart:20`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/tasks_overview.dart:34`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
