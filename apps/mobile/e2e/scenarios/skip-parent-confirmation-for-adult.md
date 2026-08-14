# Skip parent confirmation for an adult

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An adult student's absence is treated as parent-confirmed at creation and requires only the teacher's
signature to become fully excused.

## Example

Given an adult student has scheduled courses and no absences
When the student registers an absence and the teacher signs it
Then no parent confirmation action is requested
And the absence becomes fully excused after the teacher signature

## Evidence contract

| Outcome                                    | Executable evidence                                                        |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| Adult registration skips the parent        | The new absence shows only `Lehrer` pending and no parent-signature action |
| The teacher is the requested signer        | `absence-signature-screen` identifies the seeded teacher                   |
| Teacher confirmation completes the absence | The absence appears in the excused collection after relaunch               |

## State

Initial state: A configured adult has one scheduled course on a fixed date and no absences
Final state: One absence exists with both confirmation flags satisfied
Side effects: Creates one teacher signature file; restore the fixture before another run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:93`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence_view.dart:51`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/grades/confirmation_status_view.dart:49`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
