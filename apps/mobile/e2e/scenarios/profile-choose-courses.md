# Choose courses from an empty current semester

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

When the current semester has no chosen courses, My Profile explains the empty state and lets the
student choose courses without repeating license activation.

## Example

Given a configured student has no courses in the current semester
When the student chooses a class and seeded elective course from the Profile empty state
Then the chooser closes
And the selected elective and required class courses appear in the current semester

## Evidence contract

| Outcome                                                           | Executable evidence                                                                           |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `NO_COURSES_EXPLAINED` — the empty state is explicit              | The text `Du hast noch keine Kurse gewählt.` and action `Jetzt Kurse wählen` are visible      |
| `COURSE_CHOOSER_REACHED` — selection happens in the intended flow | `course-chooser-screen` is visible with class and elective controls                           |
| `CURRENT_COURSES_POPULATED` — selection replaces the empty state  | The seeded elective and required class course are visible in the current-semester course grid |
| `EMPTY_STATE_REPLACED` — the old state is gone                    | `current-semester-no-courses` is hidden after the chooser closes                              |

## State

Initial state: A configured online student has no current-semester courses and deterministic available class/course data
Final state: The selected class, required courses, and elective are stored for the current semester
Side effects: The fixture must clear current-semester course selection before another independent run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/subjects_grid.dart:32`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/subjects_grid.dart:35`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:122`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
