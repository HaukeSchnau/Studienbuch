# Teach the weekly schedule on first visit

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The first visit to My Week explains browsing and correcting the timetable, and completing or
skipping that guidance prevents it from interrupting later visits.

## Example

Given a configured student has not completed the schedule tutorial
When the student opens My Week and skips the tutorial
Then the unobscured weekly schedule is ready to use
And the tutorial does not appear on the next visit

## Evidence contract

| Outcome                                                                  | Executable evidence                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `TUTORIAL_STARTED` — first-visit guidance appears                        | `schedule-tutorial` is visible with the stable skip action and its first explanation                   |
| `SCHEDULE_READY_AFTER_SKIP` — skipping returns to the usable destination | `week-screen` is visible, `schedule-tutorial` is hidden, and week navigation is enabled                |
| `TUTORIAL_COMPLETION_PERSISTS` — guidance does not repeat                | After leaving and reopening My Week, `week-screen` is visible while `schedule-tutorial` remains hidden |

## State

Initial state: A configured student has not completed or skipped the schedule tutorial
Final state: The schedule tutorial is recorded as completed and My Week is open
Side effects: The fixture must reset tutorial completion before another independent run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/week_page_tutorial.dart:53`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/week_page_tutorial.dart:272`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/presentation/components/tutorial_provider.dart:33`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
