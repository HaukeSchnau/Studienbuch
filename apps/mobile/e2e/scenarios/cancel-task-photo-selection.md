# Cancel task photo selection without changing the task

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Cancelling the system camera or photo-library picker returns to task creation without adding an
attachment or losing entered task details.

## Example

Given task creation contains an unsaved title and no attachment
When the student opens the photo library and cancels the system picker
Then task creation still contains the entered title
And no attachment preview is shown

## Evidence contract

| Outcome                        | Executable evidence                                                              |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Task creation resumes          | `add-task-screen` is visible and ready after picker cancellation                 |
| Entered task data is preserved | `task-title-field` retains the seeded title                                      |
| Cancellation adds nothing      | `task-attachment-empty-state` is visible and `task-attachment-preview` is hidden |

## State

Initial state: Task creation has a seeded unsaved title, no attachment, and photo-library permission is granted
Final state: The unsaved task remains unchanged with no attachment
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/infrastructure/util/image_picker_util.dart:13`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/infrastructure/util/image_picker_util.dart:34`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:135`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
