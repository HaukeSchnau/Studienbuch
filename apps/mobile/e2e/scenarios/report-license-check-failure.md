# Report an unavailable licence check

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

If the activation service cannot evaluate a complete licence key, setup stays recoverable and
explains that the key could not be checked.

## Example

Given setup is incomplete and the activation backend returns an unexpected failure
When the student submits a complete licence key
Then setup reports that the licence key could not be checked
And the student remains on activation with the key available to retry

## Evidence contract

| Outcome                  | Executable evidence                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| The failure is explained | `error-notice` shows `Lizenzschlüssel konnte nicht geprüft werden`                        |
| Setup does not advance   | `license-key-screen` remains visible and `profile-setup-screen` is hidden                 |
| Retry remains possible   | `license-key-field` retains the seeded key and `setup-continue-button` returns to enabled |

## State

Initial state: Setup is incomplete, a complete key is entered, and the backend deterministically returns an unexpected failure
Final state: Setup remains incomplete on licence entry with the entered key retained
Side effects: The licence is neither activated nor persisted as accepted

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:52`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:83`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
