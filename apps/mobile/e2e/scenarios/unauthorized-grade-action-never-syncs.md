# Reject an unauthorized grade action without replaying it

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

An account without authority over a student's grade cannot approve or restore it, and reconnecting
must never apply the rejected action locally or on another device.

## Example

Given an unauthorized account opens a deterministic pending grade while offline
When the account attempts to approve the grade
Then the action is rejected and the grade remains pending
When the device reconnects
Then the grade remains pending on the student's authorized device

## Evidence contract

| Outcome                                   | Executable evidence                                                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Unauthorized intent is refused visibly    | `grade-authorization-error` is visible after the attempted approval                                                        |
| Refusal does not mutate local grade state | `grade-pending-status` remains visible on the originating device                                                           |
| Reconnect never replays rejected work     | `grade-pending-status` remains visible for the same grade on the student's authorized device after synchronization settles |

## State

Initial state: The fixture grade is pending, the acting account lacks authority over its student, the acting device is offline, and an authorized student device is synchronized
Final state: The grade remains pending everywhere and the rejected action is not queued
Side effects: Clear the fixture account session and authorization error

## Sources

- `react-native:Studienbuch-Legacy/packages/app-mobile/src/utils/sync-lifecycle.ts:50`
- `react-native:Studienbuch-Legacy/packages/app-mobile/maestro/flows/sync-lifecycle-sensitive-auth-reconnect.yml:16`
- `react-native:Studienbuch-Legacy/docs/adr/0001-standalone-api-mobile-priority.md:72`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
