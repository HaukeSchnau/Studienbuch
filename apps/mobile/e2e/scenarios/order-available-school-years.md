# Order available school years

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The year selector presents available school years in descending current-grade order with enough
context to distinguish each option.

## Example

Given profile setup can load three seeded school years for a fixed current date
When the student opens the year selector
Then the highest current grade appears first
And every option shows its current grade number and year name

## Evidence contract

| Outcome                            | Executable evidence                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Years are ordered by current grade | `school-year-options` exposes the three seeded options in descending grade order |
| Options are distinguishable        | Each seeded option follows the `<grade> (<year name>)` accessible value contract |

## State

Initial state: Setup is on profile entry, online, with three deterministic school years and a fixed current date
Final state: Profile setup remains incomplete with no year selected
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/setup_store.dart:21`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/profile_setup_page.dart:90`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/profile_setup_page.dart:106`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
