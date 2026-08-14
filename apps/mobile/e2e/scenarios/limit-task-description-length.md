# Limit task description length

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A task description is optional and accepts at most 500 characters so an unexpectedly large note
cannot be stored accidentally.

## Example

Given task creation is open with otherwise valid task details
When the student enters more than 500 deterministic characters in the description
Then the description contains only the supported 500 characters
And the task can be saved with that bounded description

## Evidence contract

| Outcome                        | Executable evidence                                                            |
| ------------------------------ | ------------------------------------------------------------------------------ |
| The limit is visible           | `task-description-field` exposes a 500-character maximum and its settled count |
| Excess input is not retained   | The field's accessible value equals the deterministic 500-character prefix     |
| The bounded task remains valid | `save-task-button` is enabled after the other required fields are complete     |

## State

Initial state: Task creation has a title, course, and due date but an empty description
Final state: The form contains a valid unsaved task with a 500-character description
Side effects: No task is saved

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:78`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:83`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:180`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
