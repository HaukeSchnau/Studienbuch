# Recover a missing course while replaying a grade

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

If an authorized replayed grade references course data absent from the receiving device, the app
recovers the required data and shows the grade without duplication or manual repair.

## Example

Given device B lacks the fixture course and devices A and B are signed in as the same student
When an authorized grade for that course is synchronized from device A
Then the fixture course appears on device B
And the grade appears once inside that course

## Evidence contract

| Outcome                                    | Executable evidence                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Replay restores the missing destination    | `fixture-recovered-course` is visible in the student's course list on device B                                     |
| The original event succeeds after recovery | `fixture-recovered-grade` is visible inside `fixture-recovered-course`                                             |
| Recovery is idempotent                     | The course list and grade list each contain exactly one matching fixture item after a second synchronization cycle |

## State

Initial state: Devices A and B share a signed-in minor student, device B lacks the fixture course projection, and the fixture grade is absent
Final state: Device B contains one recovered course projection and one applied grade
Side effects: Reset device B's fixture projection and remove the fixture grade after verification

## Sources

- `react-native:Studienbuch-Legacy/packages/app-mobile/src/utils/snapshot-recovery.ts:103`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/utils/snapshot-recovery.test.ts:8`
- `react-native:Studienbuch-Legacy/docs/architecture/sync-and-events.md:53`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
