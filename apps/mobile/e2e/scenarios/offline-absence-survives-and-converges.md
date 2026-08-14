# Preserve and synchronize an offline-created absence

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An absence recorded while offline survives process relaunch and, after reconnecting, appears exactly
once on another device signed in as the same student.

## Example

Given devices A and B are signed in as the same student and device A is offline
When the student records the fixture absence on device A
And device A is terminated and cold-launched
Then the absence is still visible on device A
When device A reconnects
Then exactly one matching absence appears on device B

## Evidence contract

| Outcome                                  | Executable evidence                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Offline creation updates local state     | `fixture-offline-absence` is visible in the identified absence list before relaunch                                               |
| Process death does not lose the absence  | `fixture-offline-absence` remains visible after cold launch on device A                                                           |
| Reconnect converges to the second device | `fixture-offline-absence` becomes visible in the identified absence list on device B                                              |
| Replay is idempotent                     | The absence list contains exactly one item matching `fixture-offline-absence` on each device after a second synchronization cycle |

## State

Initial state: Devices A and B share a signed-in minor student, device A is offline, and the deterministic absence is absent on both
Final state: One matching unexcused absence is stored and synchronized on both devices
Side effects: Delete the fixture absence on device A, reconnect, and wait for its removal from device B

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/register_absence_form.dart:94`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/absences/absence.dart:101`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/features/absences/add-absence.tsx:45`
- `react-native:Studienbuch-Legacy/packages/app-mobile/maestro/flows/sync-lifecycle-network-reconnect.yml:15`
- `react-native:Studienbuch-Legacy/docs/architecture/sync-and-events.md:5`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
