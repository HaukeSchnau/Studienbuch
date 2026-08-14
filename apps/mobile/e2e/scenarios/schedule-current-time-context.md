# Locate today and the current time in My Week

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

When the displayed week contains today, My Week visually identifies today's column and the current
time so the student can orient themselves within the schedule.

## Example

Given the current week is displayed in view mode at a frozen in-school time
When the student opens My Week
Then today's weekday column is highlighted
And a current-time indicator crosses that same weekday column at the fixture time

## Evidence contract

| Outcome                                                                     | Executable evidence                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `CURRENT_WEEK_IDENTIFIED` — the temporal context is deterministic           | `week-screen` shows the fixture calendar-week label and Monday-to-Friday range                         |
| `CURRENT_DAY_HIGHLIGHTED` — today is distinguishable from adjacent weekdays | The fixture weekday column exposes `current-day` visual state                                          |
| `CURRENT_TIME_POSITIONED` — the time marker belongs to today                | `current-time-indicator` is visible within the fixture weekday column at the seeded timetable position |

## State

Initial state: A configured student with a completed tutorial is viewing the current week in view mode at a frozen weekday time
Final state: My Week remains open and timetable data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_grid.dart:27`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_grid.dart:51`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_grid.dart:126`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_grid.dart:148`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
