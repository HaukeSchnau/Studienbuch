# Use the only available class

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

When a year has only one class, setup selects it automatically and does not require the student to
make a redundant class or optional-course choice.

## Example

Given profile setup is complete and the selected year has one class with no optional courses
When class and course setup finishes loading
Then no class selector is shown
And the student can complete setup with the class's required courses

## Evidence contract

| Outcome                                 | Executable evidence                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| The sole class needs no manual choice   | `class-selector` is hidden and `selected-class-state` identifies the seeded class |
| Optional courses are genuinely optional | `optional-course-list` is empty and `setup-continue-button` is enabled            |
| Required courses are retained           | After completion, `profile-course-list` contains the seeded required course       |

## State

Initial state: Setup has a valid profile and the selected year contains exactly one class with required courses only
Final state: Setup is complete with the sole class and its required courses persisted
Side effects: Activates the deterministic licence fixture and persists the student setup

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:82`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:89`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:112`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/setup_store.dart:137`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
