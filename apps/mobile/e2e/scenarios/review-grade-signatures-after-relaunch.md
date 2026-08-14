# Review grade signatures after relaunch

Status: accepted
Platforms: Android, iOS
Confidence: corroborated

## Rule

Completed grade confirmations and their signer evidence remain reviewable after the app process is
terminated and relaunched.

## Example

Given a minor student's written grade has teacher and parent or guardian signatures
When the app is terminated and cold-launched
And the student reopens the confirmed grade
Then the grade is still shown as confirmed
And both persisted signatures are visible with their signer identities

## Evidence contract

| Outcome                                       | Executable evidence                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Relaunch preserves settled confirmation state | `fixture-confirmed-written-grade` exposes `grade-confirmed-status` after cold launch |
| Teacher evidence remains reviewable           | `grade-teacher-signature` and its deterministic teacher label are visible            |
| Parent evidence remains reviewable            | `grade-parent-signature` and its parent or guardian label are visible                |

## State

Initial state: A signed-in minor student has one deterministic fully confirmed written grade with stored signatures
Final state: The grade and both signatures remain unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirm_with_signature.dart:149`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirmation_view.dart:25`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/written/confirm-written-grade-teacher.tsx:67`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/courses/grades/written/confirm-written-grade-parent.tsx:60`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
