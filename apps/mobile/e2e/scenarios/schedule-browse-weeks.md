# Browse the weekly schedule

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The student can browse earlier and later school weeks while always seeing which calendar week and
Monday-to-Friday date range is displayed.

## Example

Given the student is viewing a deterministic week with courses in the adjacent weeks
When the student opens the next week and then the previous week
Then each selected calendar week and date range is shown
And returning restores the original week's schedule

## Evidence contract

| Outcome                                                             | Executable evidence                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `CURRENT_WEEK_IDENTIFIED` — the starting week is unambiguous        | `week-screen` shows the fixture calendar-week label and Monday-to-Friday range  |
| `NEXT_WEEK_REACHED` — forward navigation changes the displayed week | The next fixture calendar-week label, date range, and seeded course are visible |
| `ORIGINAL_WEEK_RESTORED` — backward navigation returns to the start | The original label, range, and seeded course are visible again                  |

## State

Initial state: A configured student with a completed tutorial is viewing a frozen non-boundary calendar week with deterministic adjacent schedules
Final state: The original calendar week is displayed and timetable data is unchanged
Side effects: Navigation state only

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/week_page.dart:27`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/week_page.dart:34`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_weekdays_view.dart:13`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
