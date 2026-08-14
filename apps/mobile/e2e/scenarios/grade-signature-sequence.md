# Confirm a grade in teacher-parent order

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

A minor student's grade requires the course teacher's signature before the parent or guardian's
signature, and the settled grade preserves both confirmations for review.

## Example

Given a minor student has one unconfirmed oral grade
When the course teacher signs the grade
Then parent or guardian confirmation is requested
When the parent or guardian signs the grade
Then the grade is shown as confirmed
And both stored signatures can be reviewed

## Evidence contract

| Outcome                                          | Executable evidence                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Teacher confirmation is the first required stage | `grade-teacher-confirmation-screen` is visible and identifies the course, result, date, student, and teacher |
| Teacher confirmation advances exactly one stage  | `grade-parent-confirmation-screen` replaces the teacher screen after signing                                 |
| Both required confirmations settle the grade     | `grade-confirmed-status` is visible for the seeded grade                                                     |
| Confirmation evidence remains reviewable         | `grade-teacher-signature` and `grade-parent-signature` are visible in the confirmed-grade view               |

## State

Initial state: A signed-in minor student has one deterministic unconfirmed oral grade, and the device is online
Final state: The grade has teacher and parent or guardian confirmations
Side effects: Reset the fixture to the original unsigned grade after verification

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/oral_grade/oral_grade_row.dart:108`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirm_with_signature.dart:120`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/grade.page.tsx:67`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/components/confirm-page-content.tsx:42`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
