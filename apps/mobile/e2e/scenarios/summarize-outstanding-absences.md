# Summarize outstanding absences

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The dashboard summarizes outstanding absences by both missed courses and distinct dates and offers a
path to the complete absence list.

## Example

Given three unexcused course absences exist across two dates
When the student opens the dashboard
Then the absence summary reports three unexcused absences across two days
And the student can open the complete absence list

## Evidence contract

| Outcome                        | Executable evidence                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Missed courses are counted     | `absence-summary` reports `3 unentschuldigte Fehlzeiten`                           |
| Distinct dates are counted     | `absence-summary` reports `an 2 Tagen`                                             |
| Detail navigation is available | `view-all-absences-button` opens `absence-list-screen`, which is visible and ready |

## State

Initial state: A configured student has exactly three unexcused absence entries on two fixed dates
Final state: Absence data is unchanged and the complete absence list is open
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:70`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:81`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absense_card.dart:144`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
