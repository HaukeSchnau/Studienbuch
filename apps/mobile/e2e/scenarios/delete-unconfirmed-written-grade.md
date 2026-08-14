# Lock written-grade deletion after teacher confirmation

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A student can delete a written grade before its teacher confirms it, subject to explicit
confirmation; once the teacher has confirmed it, deletion is no longer available.

## Example

Given a written grade has not been confirmed by its teacher
When the student confirms deletion
Then the written grade is removed
Given another written grade has been confirmed by its teacher
When the student opens that grade's available actions
Then no Delete action is available

## Evidence contract

| Outcome                                       | Executable evidence                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Deletion is deliberate                        | Choosing Delete for `fixture-unsigned-written-grade` opens `delete-written-grade-confirmation`             |
| Confirmed deletion removes the pending result | `fixture-unsigned-written-grade` is absent from the identified `written-grades-section` after confirmation |
| Teacher confirmation locks deletion           | `fixture-teacher-confirmed-written-grade` is visible while its `delete-written-grade-action` is absent     |

## State

Initial state: A signed-in minor student has one unsigned and one teacher-confirmed deterministic written grade
Final state: The unsigned grade is removed and the teacher-confirmed grade remains unchanged
Side effects: Restore the deleted unsigned fixture grade after verification

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/written_grade/exam_card.dart:22`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/written_grade/exam_card.dart:67`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/written/written-grades-row.tsx:61`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/grade-card.tsx:37`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
