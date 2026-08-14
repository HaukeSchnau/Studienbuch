# Create a task with required details

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A task can be saved only with a title, course, and due date, while its description remains optional.
The saved task is available offline and survives relaunch.

## Example

Given a configured student has two courses and no tasks
When the student creates a task with a title, course, due date, and description and relaunches the app offline
Then the task appears with the entered details and due date
And it remains available without a network connection

## Evidence contract

| Outcome                              | Executable evidence                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Incomplete task data cannot be saved | `save-task-button` is disabled until title, course, and due date are present                          |
| The saved task appears in its course | `task-list` contains the seeded title under the selected course                                       |
| Saved details are durable            | `task-detail-screen` shows the seeded title, description, course, and due date after offline relaunch |

## State

Initial state: A configured student with two courses, no tasks, networking online, and a fixed current date
Final state: One open task is stored locally and remains after an offline process restart
Side effects: Remove the created task when restoring the fixture

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:33`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:42`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:73`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:173`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/tasks_overview.dart:20`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
