# Require only teacher confirmation for an adult student

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

An adult student's grade is complete after teacher confirmation and never asks for a parent or
guardian signature.

## Example

Given an adult student has one oral grade awaiting confirmation
When the course teacher signs the grade
Then the grade is shown as confirmed
And no parent or guardian confirmation is requested

## Evidence contract

| Outcome                                       | Executable evidence                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Teacher approval completes the adult grade    | `fixture-adult-grade` exposes `grade-confirmed-status` after teacher signing                              |
| Parent approval is not part of the adult flow | `grade-parent-confirmation-screen` and `parent-confirm-grade-action` are absent after reopening the grade |
| Review reflects the required signer set       | The confirmed-grade view exposes `grade-teacher-signature` and no parent-signature section                |

## State

Initial state: A signed-in adult student has one deterministic oral grade awaiting teacher confirmation and is online
Final state: The grade is confirmed by its teacher with no parent or guardian confirmation
Side effects: Reset the fixture grade to its unsigned state

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/grades_card/oral_grade/add_oral_grade_form.dart:131`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirmation_view.dart:167`
- `react-native:Studienbuch-Legacy/packages/student/src/repositories/grades.repo.ts:68`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/components/confirmation-status.tsx:39`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
