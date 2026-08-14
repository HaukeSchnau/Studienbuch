# Collect a valid student profile

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Setup advances only after the student supplies a non-blank name and a year and explicitly records
whether the student is an adult.

## Example

Given a valid licence has been accepted and the available years have loaded
When the student enters a name, selects a year, marks themselves as an adult, and continues
Then setup advances to class and course selection
And no validation error remains on the completed profile step

## Evidence contract

| Outcome                               | Executable evidence                                                        |
| ------------------------------------- | -------------------------------------------------------------------------- |
| Incomplete profiles cannot advance    | `setup-continue-button` is disabled with a blank name or no selected year  |
| The next setup destination is reached | `class-course-setup-screen` is visible and ready                           |
| Valid profile input is accepted       | The profile controls no longer expose a validation error before navigation |

## State

Initial state: Setup has accepted a valid licence, years are deterministically loaded, and profile fields are empty
Final state: The in-progress setup store contains the normalized profile and is on class/course selection
Side effects: No completed user profile has been persisted yet

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/profile_setup_page.dart:20`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/profile_setup_page.dart:26`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/profile_setup_page.dart:43`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/profile_setup_page.dart:64`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
