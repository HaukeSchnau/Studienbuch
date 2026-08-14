# Adapt primary navigation to the available width

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The three primary destinations remain available when the app moves between compact and expanded
layouts, while the navigation presentation adapts to the available width.

## Example

Given a configured student is using a compact application window
When the application window becomes wider than the expanded-layout threshold
Then Overview, My Week, and My Profile remain available
And expanded navigation replaces compact navigation without changing the current destination

## Evidence contract

| Outcome                                                                    | Executable evidence                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `COMPACT_NAVIGATION_VISIBLE` — compact navigation is used initially        | `compact-main-navigation` is visible with all three destination targets            |
| `EXPANDED_NAVIGATION_VISIBLE` — expanded navigation is used after resizing | `expanded-main-navigation` is visible with all three destination targets           |
| `COMPACT_NAVIGATION_REPLACED` — both variants are not exposed together     | `compact-main-navigation` is hidden after the expanded layout settles              |
| `DESTINATION_PRESERVED` — resizing does not navigate                       | The same destination screen remains visible and selected before and after resizing |

## State

Initial state: A configured student is on Overview in a compact resizable simulator window
Final state: The student remains on Overview in an expanded window
Side effects: Window size changes; application data remains unchanged

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/root_page.dart:67`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/infrastructure/util/ui_util.dart:5`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
