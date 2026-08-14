# Cancel grade signing without confirming

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

Leaving a grade-signature screen through Cancel does not confirm the grade or advance it to the next
signer.

## Example

Given a minor student's oral grade is awaiting teacher confirmation
When the teacher opens the signing screen and cancels
Then the grade is still awaiting teacher confirmation
And parent confirmation is not requested

## Evidence contract

| Outcome                              | Executable evidence                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Cancel returns without advancing     | The course grade overview is visible after Cancel and `fixture-pending-grade` exposes `grade-teacher-pending-status` |
| The later signer remains unavailable | `parent-confirm-grade-action` is absent for `fixture-pending-grade`                                                  |

## State

Initial state: A signed-in minor student has one deterministic oral grade awaiting its teacher signature
Final state: The grade remains unsigned by teacher and parent or guardian
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirm_with_signature.dart:111`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirm_with_signature.dart:139`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/components/confirm-page-content.tsx:42`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/grade.page.tsx:67`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
