# Outcome-oriented scenario title

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

State the user-visible product guarantee in one short paragraph. Describe what remains true, not
the current sequence of widgets used to achieve it.

## Example

Given one named, deterministic starting state
When the actor performs the principal behavior
Then one externally observable outcome occurs
And any discriminating outcome or absence is observable

## Evidence contract

| Outcome                                  | Executable evidence                                   |
| ---------------------------------------- | ----------------------------------------------------- |
| Name the guarantee without runner syntax | Name the semantic target and the state it must expose |

## State

Initial state: Name the fixture, network, session, time, and permission state that matter
Final state: Describe the persistent state after the scenario
Side effects: Describe restoration, external effects, or `None`

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/path/to/evidence.dart:1`
- `react-native:Studienbuch-Legacy/packages/app-mobile/src/path/to/evidence.tsx:1`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
