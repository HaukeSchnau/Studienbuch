# Converge an offline grade after reconnecting

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An authorized grade mutation made while one student device is offline is published once after
reconnect and converges to the same visible state on another device for that student.

## Example

Given devices A and B are signed in as the same student and device A is offline
When the student records a written grade on device A
And device A reconnects
Then the grade becomes synchronized on device A
And exactly one matching grade appears on device B

## Evidence contract

| Outcome                                                    | Executable evidence                                                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| The originating mutation remains visible through reconnect | `fixture-reconnected-written-grade` is visible on device A before and after reconnect                  |
| The second device converges                                | `fixture-reconnected-written-grade` is visible in the same course on device B                          |
| Replay does not duplicate the mutation                     | `written-grade-list` contains exactly one item with `fixture-reconnected-written-grade` on each device |

## State

Initial state: Devices A and B share a signed-in minor student, device A is offline, and the fixture grade is absent on both
Final state: One matching written grade is synchronized and visible on both devices
Side effects: Remove the fixture grade on device A, reconnect, and await its removal on device B

## Sources

- `react-native:Studienbuch-Legacy/docs/architecture/sync-and-events.md:5`
- `react-native:Studienbuch-Legacy/packages/app-mobile/maestro/flows/sync-lifecycle-network-reconnect.yml:15`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/utils/sync-lifecycle.ts:47`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
