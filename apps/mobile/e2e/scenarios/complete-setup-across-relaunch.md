# Preserve completed setup across relaunch

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Completing setup activates the licence and durably stores the student profile, class, required
courses, and selected optional courses so the next cold launch enters the main application.

## Example

Given the final setup step contains a valid profile, one class, and one selected optional course
When the student completes setup and cold-launches the app again
Then the main application greets the student by their saved name
And the saved required and optional courses are available without repeating setup

## Evidence contract

| Outcome                           | Executable evidence                                                        |
| --------------------------------- | -------------------------------------------------------------------------- |
| Setup completes                   | `main-navigation` is visible and `license-key-screen` is hidden            |
| The profile survives relaunch     | `home-greeting` contains the seeded student's short name after cold launch |
| Required courses survive relaunch | `profile-course-list` contains the seeded non-choosable course             |
| Optional courses survive relaunch | `profile-course-list` contains the selected optional course                |

## State

Initial state: Setup is on its final step online with a backend-valid unactivated licence and deterministic school data
Final state: The licence is activated and the complete local student setup persists across process restart
Side effects: Consumes the deterministic licence fixture; reset the scenario fixture before another run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/welcome_page.dart:27`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/setup_store.dart:70`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/setup_store.dart:89`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/setup_store.dart:137`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/business_domain/user/use_user.dart:26`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/router.dart:19`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
