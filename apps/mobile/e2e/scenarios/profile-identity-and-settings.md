# Review profile identity and settings

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

My Profile identifies the student and school year and provides direct access to app information,
feedback, and profile-and-course editing.

## Example

Given a configured student has a deterministic name and school year
When the student opens My Profile and then opens Settings
Then the student's initials, name, year, and class level are shown
And About, Feedback, and profile-and-course editing are available

## Evidence contract

| Outcome                                                              | Executable evidence                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `PROFILE_IDENTITY_VISIBLE` — the correct student is identified       | `profile-screen` shows the seeded initials and first-name profile heading            |
| `SCHOOL_YEAR_VISIBLE` — school context is identified                 | The seeded year name and calculated class level are visible                          |
| `PROFILE_SETTINGS_VISIBLE` — accepted settings actions are available | The settings sheet shows `Über die App`, `Feedback`, and `Profil & Kurse bearbeiten` |

## State

Initial state: A configured student with a deterministic multi-part name and school year is on My Profile
Final state: The profile settings sheet is open and data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/top_panel.dart:26`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/top_panel.dart:30`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/top_panel.dart:93`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
