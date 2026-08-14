# Navigate between the main destinations

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A configured student can move directly between Overview, My Week, and My Profile, with exactly one
of those destinations selected at a time.

## Example

Given a configured student is on Overview
When the student opens My Week and then My Profile
Then each requested destination is shown
And the previously selected destination is no longer selected

## Evidence contract

| Outcome                                                                | Executable evidence                                                               |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `MAIN_DESTINATIONS_AVAILABLE` — all primary destinations are available | The semantic targets `main-overview`, `main-week`, and `main-profile` are visible |
| `WEEK_DESTINATION_REACHED` — My Week is reached                        | `week-screen` is visible and `main-week` exposes its selected state               |
| `PROFILE_DESTINATION_REACHED` — My Profile is reached                  | `profile-screen` is visible and `main-profile` exposes its selected state         |
| `ONLY_PROFILE_SELECTED` — the old destination is no longer selected    | `main-profile` is selected while `main-week` and `main-overview` are not selected |

## State

Initial state: A configured student with a completed schedule tutorial is on Overview
Final state: The same student is on My Profile with application data unchanged
Side effects: Navigation state only

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/root_page.dart:24`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/root_page.dart:56`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
