# Save the current overall grade

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

A student can record the current overall grade for a course, after which the new value is visible
and awaits its required confirmations.

## Example

Given a minor student has a course with no current overall grade
When the student enters valid points and saves the overall grade
Then those points are shown as the current overall grade
And teacher confirmation is required

## Evidence contract

| Outcome                                   | Executable evidence                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Saving updates the current overall result | `current-master-grade` exposes the entered fixture points after the entry sheet closes |
| A new overall result is pending           | `current-master-grade` exposes `grade-teacher-pending-status` and the Confirm action   |

## State

Initial state: A signed-in minor student is online and the deterministic course has no current overall grade
Final state: The entered overall grade is current and unconfirmed
Side effects: Remove the fixture overall grade after verification

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/master_grade/add_master_grade_form.dart:43`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/master_grade/add_master_grade_form.dart:104`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/master/edit-master-grade.tsx:47`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/master/master-grade-row.tsx:54`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
