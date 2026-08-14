# Restart interrupted setup safely

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Setup is committed only when its final step succeeds, so interrupting an earlier step cannot create a
partially configured student account.

## Example

Given the student has accepted a valid licence and entered profile details without completing setup
When the app process is terminated and cold-launched
Then setup starts again at licence entry
And the main application remains inaccessible

## Evidence contract

| Outcome                                  | Executable evidence                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Partial setup is not treated as complete | `license-key-screen` is visible after cold launch                          |
| Authenticated content remains protected  | `main-navigation` and `home-screen` are hidden                             |
| No partial profile leaked into the app   | The activation screen contains no saved-profile greeting or course content |

## State

Initial state: Setup has in-memory licence and profile data but has not completed class/course selection
Final state: Setup remains incomplete with no persisted local user
Side effects: The deterministic licence was checked but not activated

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/welcome_page.dart:23`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/welcome_page.dart:27`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/setup_store.dart:70`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/router.dart:19`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
