# Reject an invalid licence key

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An invalid licence key does not advance setup and receives a specific, actionable rejection.

## Example

Given setup is incomplete and the activation backend will reject the entered licence key
When the student submits the complete licence key
Then the activation screen reports that the licence key is invalid
And the student remains on activation with the entered key available to correct

## Evidence contract

| Outcome                    | Executable evidence                                                       |
| -------------------------- | ------------------------------------------------------------------------- |
| The rejection is specific  | `license-key-error` shows `Ungültiger Lizenzschlüssel`                    |
| Setup does not advance     | `license-key-screen` remains visible and `profile-setup-screen` is hidden |
| The input can be corrected | `license-key-field` remains visible and enabled                           |

## State

Initial state: Setup is incomplete, the backend is reachable, and a deterministic key is configured as invalid
Final state: Setup remains incomplete on licence entry
Side effects: The licence is neither activated nor persisted as accepted

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:52`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:70`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
