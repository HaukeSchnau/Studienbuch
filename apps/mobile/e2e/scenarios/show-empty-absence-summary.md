# Explain an empty absence history

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A student with no recorded absences sees a clear empty state and can start registering an absence
directly from the dashboard.

## Example

Given a configured student has no absence entries
When the student opens the dashboard
Then the absence card explains that no absences have been recorded
And the action to register an absence is available while the all-absences action is absent

## Evidence contract

| Outcome                            | Executable evidence                                                  |
| ---------------------------------- | -------------------------------------------------------------------- |
| The empty state is explicit        | `absence-summary` shows `Du hast noch keine Fehlzeiten eingetragen.` |
| Registration remains available     | `add-absence-button` is visible and enabled                          |
| Empty history has no detail action | `view-all-absences-button` is hidden                                 |

## State

Initial state: A configured student has no absence entries and networking does not matter
Final state: Absence data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:25`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:122`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:135`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:144`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
