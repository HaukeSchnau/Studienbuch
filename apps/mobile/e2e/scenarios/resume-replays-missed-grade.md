# Replay a missed grade when the app resumes

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

When an inactive student device misses an authorized grade update, returning the application to the
foreground refreshes synchronization and reveals the update without requiring a manual reload.

## Example

Given devices A and B are signed in as the same student and the app is backgrounded on device B
When an authorized grade update is completed on device A
And the app returns to the foreground on device B
Then the updated grade is shown on device B
And it appears only once

## Evidence contract

| Outcome                                    | Executable evidence                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Foreground resume catches up automatically | `fixture-resumed-grade` becomes visible after device B returns to the app                                  |
| Resume replay is idempotent                | `grade-list` contains exactly one item with `fixture-resumed-grade` after a second background-resume cycle |

## State

Initial state: Devices A and B share a signed-in minor student, device B is synchronized and backgrounded, and the fixture update is absent
Final state: The authorized update is synchronized once to device B
Side effects: Remove the fixture grade and wait for both devices to converge

## Sources

- `react-native:Studienbuch-Legacy/packages/app-mobile/src/app/_layout.tsx:98`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/utils/sync-lifecycle.ts:31`
- `react-native:Studienbuch-Legacy/packages/app-mobile/maestro/flows/sync-lifecycle-resume.yml:7`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
