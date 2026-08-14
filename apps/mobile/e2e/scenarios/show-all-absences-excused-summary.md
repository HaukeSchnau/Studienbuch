# Celebrate a fully excused absence history

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

When every recorded absence is excused, the dashboard distinguishes that success from both an empty
history and an outstanding absence state.

## Example

Given a configured student has recorded absences and every one is fully excused
When the student opens the dashboard
Then the absence card reports that all absences are excused
And the complete absence history remains available

## Evidence contract

| Outcome                            | Executable evidence                                                      |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Fully excused history is explicit  | `absence-summary` shows `Super! All deine Fehlzeiten sind entschuldigt!` |
| No outstanding warning is shown    | `outstanding-absence-warning` is hidden                                  |
| Existing history remains reachable | `view-all-absences-button` is visible and enabled                        |

## State

Initial state: A configured student has at least one absence and every entry is parent- and teacher-confirmed
Final state: Absence data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:41`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:53`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:144`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
