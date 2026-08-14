# Calculate the written average from confirmed grades

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

Pending written grades remain visible but do not influence the written average until their required
confirmations are complete.

## Example

Given a course has one confirmed written grade worth 10 points and one pending written grade worth 4 points
When the student opens the course grade overview
Then both written grades are shown
And the written average is 10 points

## Evidence contract

| Outcome                                 | Executable evidence                                                 |
| --------------------------------------- | ------------------------------------------------------------------- |
| The confirmed grade remains represented | `written-grade-confirmed-10` is visible in `written-grades-section` |
| The pending grade remains represented   | `written-grade-pending-4` is visible in `written-grades-section`    |
| Pending work does not affect the result | `written-grade-average` exposes 10 points rather than 7 points      |

## State

Initial state: A signed-in minor student has a deterministic course with confirmed 10-point and pending 4-point written grades
Final state: Grade state is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/written_grade/written_grade_row.dart:30`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/written/written-grades-row.tsx:13`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
