# Attach a photo to a task

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A student can attach a photo from the camera or photo library, review it before saving, and open the
persisted attachment from task details.

## Example

Given task creation is open and camera and photo-library permission is granted
When the student chooses a deterministic library photo and saves a valid task
Then the selected photo is shown before saving
And the same photo can be opened from the saved task after relaunch

## Evidence contract

| Outcome                            | Executable evidence                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| Both supported sources are offered | `task-photo-source-sheet` exposes `Galerie` and `Kamera`                                 |
| The selected photo is attached     | `task-attachment-preview` is visible before save                                         |
| The attachment is durable          | `task-attachment-thumbnail` is visible after relaunch and opens `task-attachment-viewer` |

## State

Initial state: Task creation is open for a seeded course, one deterministic photo is available, and media permissions are granted
Final state: One task and one locally persisted attachment remain after relaunch
Side effects: Creates a copied attachment file; remove the task and file when restoring the fixture

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/infrastructure/util/image_picker_util.dart:6`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:93`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:135`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/add_task_form.dart:181`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/tasks/task_page.dart:207`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
