# Save the current oral grade

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

A student can record the current oral grade for a course, after which the new value is visible and
awaits its required confirmations.

## Example

Given a minor student has a course with no current oral grade
When the student enters valid points and saves the oral grade
Then those points are shown as the current oral grade
And teacher confirmation is required

## Evidence contract

| Outcome                                | Executable evidence                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| Saving updates the current oral result | `current-oral-grade` exposes the entered fixture points after the entry sheet closes |
| A new oral result is pending           | `current-oral-grade` exposes `grade-teacher-pending-status` and the Confirm action   |

## State

Initial state: A signed-in minor student is online and the deterministic course has no current oral grade
Final state: The entered oral grade is current and unconfirmed
Side effects: Remove the fixture oral grade after verification

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/oral_grade/add_oral_grade_form.dart:43`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/oral_grade/add_oral_grade_form.dart:104`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/oral/edit-oral-grade.tsx:47`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/oral/oral-grades-row.tsx:52`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
