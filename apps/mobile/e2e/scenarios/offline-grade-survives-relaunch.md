# Preserve an offline grade across relaunch

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A grade recorded without connectivity is immediately available locally and remains available after
the application process is terminated and relaunched.

## Example

Given a signed-in student is offline and a course has no pending written grade on the fixture date
When the student records a written grade
And the app is terminated and cold-launched
Then the recorded grade is still shown for the course

## Evidence contract

| Outcome                                       | Executable evidence                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| Offline entry updates the local product state | `fixture-offline-written-grade` is visible before relaunch                            |
| Process death does not lose the mutation      | `fixture-offline-written-grade` is visible after cold launch and reopening the course |

## State

Initial state: A signed-in minor student is offline, the fixture course is locally available, and its fixture date has no written grade
Final state: One locally persisted written grade exists while the device remains offline
Side effects: Reconnect and remove the fixture grade after verification

## Sources

- `react-native:Studienbuch-Legacy/packages/app-mobile/README.md:5`
- `react-native:Studienbuch-Legacy/packages/app-mobile/maestro/flows/sync-lifecycle-replay.yml:4`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/utils/groundswell.tsx:164`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
