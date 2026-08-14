# Confirm a minor's absence in order

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A minor's absence requires parent confirmation before teacher confirmation, and it is fully excused
only after both signatures are saved.

## Example

Given a minor has one unconfirmed absence
When a parent signs it and the teacher then signs it
Then the available confirmation action advances from parent to teacher
And the absence moves to the excused collection only after the teacher signature

## Evidence contract

| Outcome                                   | Executable evidence                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Parent confirmation comes first           | The initial status shows parent and teacher pending, and the signature screen identifies `Unterschrift der Eltern` |
| Parent confirmation alone is insufficient | After the parent signature, teacher remains pending and the absence remains in the unexcused collection            |
| Teacher confirmation is next              | The next signature screen identifies the seeded teacher as signer                                                  |
| Both signatures complete the journey      | The absence is absent from unexcused count and visible in the excused collection after relaunch                    |

## State

Initial state: A configured minor has one absence with neither confirmation and deterministic signer data
Final state: The absence is parent-confirmed, teacher-confirmed, and durably excused
Side effects: Creates parent and teacher signature files; restore the fixture before another run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:51`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:66`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:125`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirmation_status_view.dart:49`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirm_with_signature.dart:132`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
