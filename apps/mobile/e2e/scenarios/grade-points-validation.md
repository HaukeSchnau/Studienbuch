# Accept only valid grade points

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

A student can save a grade only when its points are a number from 0 through 15, inclusive; both a
decimal comma and a decimal point represent the same value.

## Example

Given the grade-entry sheet is open for a course with no pending edit
When the student enters points outside the range from 0 through 15
Then the Save action remains unavailable
When the student enters `12,5`
Then the Save action becomes available

## Evidence contract

| Outcome                                    | Executable evidence                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| An out-of-range result cannot be committed | `grade-save-action` exposes its disabled state while `grade-points-field` contains `16`  |
| A decimal-comma result is accepted         | `grade-save-action` exposes its enabled state while `grade-points-field` contains `12,5` |

## State

Initial state: A signed-in minor student has one selected course, the device is online, and its grade-entry sheet is open
Final state: No grade has been saved
Side effects: Clear the points field before closing the sheet

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/master_grade/add_master_grade_form.dart:30`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/written_grade/add_written_grade_form.dart:28`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/master/edit-master-grade.tsx:43`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/written/add-written-grade.tsx:25`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
