# Require an absence reason and course

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An absence cannot be saved without a reason and at least one scheduled course selected for the date.

## Example

Given absence registration shows two scheduled courses for a fixed date
When the student leaves the reason empty or deselects every course
Then saving remains unavailable
And saving becomes available only after a reason and at least one course are present

## Evidence contract

| Outcome                        | Executable evidence                                                         |
| ------------------------------ | --------------------------------------------------------------------------- |
| A reason is required           | `save-absence-button` is disabled with selected courses and an empty reason |
| A selected course is required  | `save-absence-button` is disabled with a reason and every course deselected |
| Valid absence data is accepted | `save-absence-button` becomes enabled with a reason and one selected course |

## State

Initial state: A configured minor has two courses on a fixed weekday and absence registration is open
Final state: The form contains valid unsaved absence data
Side effects: No absence is created

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:18`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:22`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:36`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:65`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
