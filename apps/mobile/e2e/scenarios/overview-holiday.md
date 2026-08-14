# Celebrate a school holiday on Overview

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

When the relevant school day falls within a known holiday, Overview replaces the ordinary agenda
with a clear holiday greeting.

## Example

Given the relevant school day is within seeded autumn holidays
When the student opens Overview
Then an autumn-holiday greeting is shown
And the ordinary daily agenda is not shown

## Evidence contract

| Outcome                                                                          | Executable evidence                                                     |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `HOLIDAY_GREETING_VISIBLE` — the holiday is recognized                           | The text `Schöne Herbstferien!` is visible with a celebration indicator |
| `DAILY_AGENDA_REPLACED` — ordinary lessons do not compete with the holiday state | `overview-agenda` is hidden while `overview-holiday` is visible         |

## State

Initial state: A configured student has a frozen date inside deterministic autumn-holiday fixture data
Final state: Holiday and timetable data are unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/home_page.dart:46`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/holidays/holidays.dart:42`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
