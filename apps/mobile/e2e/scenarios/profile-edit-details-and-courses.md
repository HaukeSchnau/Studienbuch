# Edit profile details and courses

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A configured student can update profile details and current courses from Settings, then return to
My Profile with the committed changes visible.

## Example

Given a configured online student is viewing My Profile
When the student changes the name, age status, class, and one elective and completes the edit flow
Then My Profile shows the updated identity and school context
And the current-semester course grid reflects the new course selection

## Evidence contract

| Outcome                                                                   | Executable evidence                                                                            |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `PROFILE_EDIT_REACHED` — editing starts from the accepted settings action | The profile form is visible with the existing seeded name and year                             |
| `PROFILE_DETAILS_UPDATED` — committed identity changes are visible        | `profile-screen` shows the updated initials and first-name profile heading                     |
| `COURSE_SELECTION_UPDATED` — committed course changes are visible         | The new elective is visible and the replaced elective is absent from the current-semester grid |
| `EDIT_FLOW_CLOSED` — completion returns to Profile                        | `profile-screen` is visible and `profile-edit-screen` is hidden                                |

## State

Initial state: A configured online student has deterministic editable profile, class, and course data
Final state: The updated name, age status, class, and elective are stored
Side effects: The fixture must restore the original profile and course selection before another independent run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/top_panel.dart:49`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/edit_profile_page.dart:21`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/setup/edit_profile_page.dart:28`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
