# Review app information

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The student can identify the installed Studienbuch application, its version, legal notice, and
bundled software licenses from Profile settings.

## Example

Given a configured student has opened Profile settings
When the student opens About
Then the Studienbuch application name, installed version, and current legal notice are shown
And bundled software licenses are available on the same destination

## Evidence contract

| Outcome                                                          | Executable evidence                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ABOUT_DESTINATION_REACHED` — the About screen is identified     | `about-screen` is visible after selecting `Über die App`                           |
| `APP_IDENTITY_VISIBLE` — the installed application is named      | The text `Studienbuch: IGS Lilienthal` and the installed version label are visible |
| `LEGAL_NOTICE_VISIBLE` — ownership is presented                  | The current-year Hauke Schnau copyright notice is visible                          |
| `SOFTWARE_LICENSES_AVAILABLE` — bundled licenses can be reviewed | `software-licenses-list` is visible or directly reachable on `about-screen`        |

## State

Initial state: A configured student has Profile settings open in a deterministic installed build
Final state: About is open and application data is unchanged
Side effects: Navigation state only

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/top_panel.dart:30`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/about/about_page.dart:19`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
