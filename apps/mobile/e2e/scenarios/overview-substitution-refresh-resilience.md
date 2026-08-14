# Keep the local schedule available when substitution refresh fails

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Returning to the foreground refreshes substitutions, and a failed refresh explains that current
substitution information is unavailable without removing the student's local schedule.

## Example

Given a configured student has a local schedule and substitution refresh will fail offline
When the app returns to the foreground
Then the local course times remain available on Overview
And the app explains that substitutions cannot currently be shown

## Evidence contract

| Outcome                                                                             | Executable evidence                                                                                                                      |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `FOREGROUND_REFRESH_TRIGGERED` — returning activates substitution refresh           | The substitution-unavailable notice is absent before backgrounding and appears after the app resumes into the fixture-controlled failure |
| `LOCAL_SCHEDULE_REMAINS_AVAILABLE` — local-first schedule data survives the failure | `overview-agenda` remains visible with the seeded course names and times                                                                 |
| `SUBSTITUTION_REFRESH_FAILURE_EXPLAINED` — freshness failure is explicit            | A user-visible notice states that the student is offline and substitutions are not currently shown                                       |

## State

Initial state: A configured student has a deterministic local schedule and a lifecycle fixture that makes the next foreground substitution refresh fail offline
Final state: The app is foregrounded with the unchanged local schedule visible; no substitution freshness is asserted
Side effects: Network failure is fixture-controlled and restored after the scenario

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/main.dart:22`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/main.dart:31`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/agenda_store.dart:54`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/models/agenda_store.dart:62`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
