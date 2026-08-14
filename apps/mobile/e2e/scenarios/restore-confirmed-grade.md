# Restore the latest confirmed grade

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

When a newer current grade is still unconfirmed, a student can restore the most recent confirmed
grade as the course's current grade.

## Example

Given a course has an older confirmed oral grade and a newer unconfirmed oral grade
When the student restores the latest confirmed grade
Then the confirmed result becomes the current oral grade
And the unconfirmed result no longer controls the course overview

## Evidence contract

| Outcome                                         | Executable evidence                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| The eligible confirmed value is offered         | `latest-confirmed-grade` identifies the seeded confirmed result and exposes `restore-grade-action` |
| Restore changes the current result              | `current-oral-grade` exposes the confirmed result after the sheet closes                           |
| The replaced pending value is no longer current | `current-oral-grade` does not expose the seeded unconfirmed result                                 |

## State

Initial state: A signed-in minor student has a deterministic course with an older confirmed and newer pending oral grade
Final state: The older confirmed grade is the current oral grade
Side effects: Restore the two-grade fixture after verification

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/oral_grade/add_oral_grade_form.dart:72`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/oral/edit-oral-grade.tsx:59`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
