# Recover setup after reconnection

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Setup clearly explains when connectivity blocks progress and becomes usable again after connectivity
returns without discarding entered data.

## Example

Given setup is incomplete with a complete licence key entered and the device offline
When network connectivity is restored
Then setup reports that the connection was restored
And the complete licence key can be submitted without being entered again

## Evidence contract

| Outcome                         | Executable evidence                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| The offline state is explained  | `network-notice` shows the offline message while disconnected                              |
| Progress is blocked offline     | `setup-continue-button` is disabled while disconnected                                     |
| Recovery is acknowledged        | `network-recovered-notice` shows `Verbindung wiederhergestellt! 🚀`                        |
| Entered state survives recovery | `license-key-field` retains the normalized key and `setup-continue-button` becomes enabled |

## State

Initial state: Setup is incomplete, a complete valid key is entered, and all device networking is disabled
Final state: Setup remains incomplete on licence entry with networking restored
Side effects: Network connectivity is restored; the licence has not been submitted

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:37`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/forms/license_form.dart:134`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/infrastructure/hooks/use_has_network.dart:32`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
