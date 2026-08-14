# Select a class and optional courses

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The student chooses their class when several are available and may choose the optional courses that
belong to that class before completing setup.

## Example

Given profile setup is complete and the selected year has two classes with distinct optional courses
When the student selects one class and one of its optional courses
Then only optional courses belonging to that class are offered
And setup can be completed with the selected class and course

## Evidence contract

| Outcome                                    | Executable evidence                                                                                            |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Class selection is required when ambiguous | `setup-continue-button` is disabled before a class is selected                                                 |
| Courses are scoped to the class            | `optional-course-list` contains the seeded course for the selected class and excludes the other class's course |
| The selection is accepted                  | `setup-continue-button` is enabled and `selected-optional-course` identifies the chosen course                 |

## State

Initial state: Setup has a valid profile, networking is online, and the year fixture contains two classes
Final state: One class and one optional course are selected in the in-progress setup
Side effects: No completed user profile has been persisted yet

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:64`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:82`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:96`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/classes_courses_setup_page.dart:112`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
