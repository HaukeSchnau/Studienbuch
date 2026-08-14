# Show a holiday across the weekly schedule

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A known holiday overlapping the displayed school week is shown across the affected weekday columns
with a recognizable holiday name.

## Example

Given a seeded autumn holiday covers Tuesday and Wednesday of the displayed week
When the student opens My Week
Then Tuesday and Wednesday are visibly covered by the holiday state
And the holiday is named as autumn holidays

## Evidence contract

| Outcome                                                                    | Executable evidence                                                                           |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `HOLIDAY_WEEK_IDENTIFIED` — the expected week is displayed                 | `week-screen` shows the fixture calendar-week label and date range                            |
| `HOLIDAY_COLUMNS_HIGHLIGHTED` — the affected days are visually grouped     | Tuesday and Wednesday expose `holiday` visual state while Monday, Thursday, and Friday do not |
| `HOLIDAY_NAME_VISIBLE` — the overlay is understandable without color alone | The text `Herbstferien` is visible within `schedule-holiday-overlay`                          |

## State

Initial state: A configured student with a completed tutorial is viewing a deterministic week with an autumn holiday covering Tuesday and Wednesday
Final state: My Week remains open and holiday and timetable data are unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_grid.dart:70`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_grid.dart:86`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_grid.dart:188`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/holidays/holidays.dart:42`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
