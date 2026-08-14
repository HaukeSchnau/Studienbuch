# Save a written grade within its semester

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

A student can record a written grade with points and an exam date inside the course semester; the
saved result appears as a pending written grade for that course.

## Example

Given a minor student is adding a written grade to a course in a known semester
When the student opens the exam-date choice
Then dates before or after the course semester are unavailable
When the student chooses a date inside that semester, enters valid points, and saves
Then the written grade is shown with the chosen date and points
And the grade is awaiting teacher confirmation

## Evidence contract

| Outcome                                             | Executable evidence                                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The exam date is constrained to the course semester | `written-grade-date-field` exposes the fixture semester start and end as its selectable bounds |
| Saving creates the specified grade                  | `fixture-written-grade` exposes the chosen date and points in `written-grades-section`         |
| A newly entered grade is not silently confirmed     | `fixture-written-grade` exposes `grade-teacher-pending-status`                                 |

## State

Initial state: A signed-in minor student has a deterministic course and semester, is online, and the fixture written grade is absent
Final state: One pending written grade exists on the chosen in-semester date
Side effects: Remove the fixture written grade after verification

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/written_grade/add_written_grade_form.dart:26`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/written_grade/add_written_grade_form.dart:46`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/written/add-written-grade.tsx:28`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/written/written-grades-row.tsx:61`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
