# Keep the app usable when notifications are declined

Status: accepted
Platforms: Android, iOS
Confidence: inferred

## Rule

Declining notification permission does not block setup completion or access to any core student
workflow.

## Example

Given setup is complete and notification permission has not been decided
When the student declines the system notification request
Then the Overview destination remains ready for use
And the three primary destinations remain available

## Evidence contract

| Outcome                                           | Executable evidence                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Permission denial does not replace the product UI | `overview-screen` is visible after the system prompt closes               |
| Core navigation remains usable                    | `overview-tab`, `schedule-tab`, and `profile-tab` are visible and enabled |

## State

Initial state: A signed-in student has completed setup, notification permission is not determined, and the device is online
Final state: Notification permission is denied and the student remains on Overview
Side effects: Reset notification permission for the app after verification

## Sources

- `react-native:Studienbuch-Legacy/packages/app-mobile/src/app/(main)/_layout.tsx:31`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/utils/notifications.ts:39`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/app/(main)/_layout.tsx:73`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
