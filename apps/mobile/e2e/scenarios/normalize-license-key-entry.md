# Normalize licence-key entry

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Licence keys are entered in one predictable uppercase, grouped format before they can be submitted.

## Example

Given setup is incomplete and the activation screen is ready online
When the student enters a lowercase alphanumeric licence key
Then the key is displayed as four uppercase groups of four characters
And submission remains unavailable until all four groups are complete

## Evidence contract

| Outcome                                | Executable evidence                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| The key has a normalized display value | `license-key-field` exposes `AB12-CD34-EF56-GH78`                             |
| An incomplete key cannot be submitted  | `setup-continue-button` is disabled before the nineteenth displayed character |
| A complete key can be submitted        | `setup-continue-button` is enabled after all four groups are complete         |

## State

Initial state: Setup is incomplete, the activation backend is reachable, and the licence field is empty
Final state: Setup remains incomplete with a normalized complete key in the field
Side effects: The licence has not been checked or activated

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:15`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:45`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:134`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
