# Default an absence to the next weekday

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Absence registration starts on today during the school week and advances a weekend date to the
following Monday.

## Example

Given the device clock is fixed to a Saturday and the student has courses on the following Monday
When the student opens absence registration
Then the selected date is the following Monday
And Monday's scheduled courses are offered

## Evidence contract

| Outcome                                   | Executable evidence                                          |
| ----------------------------------------- | ------------------------------------------------------------ |
| Weekend registration advances predictably | `absence-date-picker` exposes the fixture's following Monday |
| Course choices follow the effective date  | `absence-course-list` contains the seeded Monday course      |

## State

Initial state: A configured student has a Monday course, no absences, and the device clock is fixed to Saturday
Final state: Absence registration remains open for Monday with no absence saved
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:18`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:22`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/infrastructure/util/date_util.dart:10`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
