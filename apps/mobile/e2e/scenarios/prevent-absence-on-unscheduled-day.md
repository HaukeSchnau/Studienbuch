# Prevent an absence on an unscheduled day

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An absence cannot be registered for a date on which the student has no scheduled courses.

## Example

Given absence registration is open for a fixed date with no scheduled courses
When the student enters a reason
Then no course can be selected
And saving remains unavailable

## Evidence contract

| Outcome                          | Executable evidence                                                           |
| -------------------------------- | ----------------------------------------------------------------------------- |
| The date has no eligible courses | `absence-course-empty-state` is visible and `absence-course-option` is absent |
| No empty absence can be stored   | `save-absence-button` remains disabled after a reason is entered              |

## State

Initial state: A configured student has no timetable entries on the fixed selected date and no absence for it
Final state: No absence has been created
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:22`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:25`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:36`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
