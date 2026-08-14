# Move a course to another timetable slot

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

While correcting the timetable, the student can move an existing course to a different weekday and
lesson start, with the result snapped to a valid timetable slot and retained on return.

## Example

Given a seeded course occupies Monday's first lesson
When the student moves it to Tuesday's second lesson
Then the course appears in Tuesday's second lesson
And it no longer appears in Monday's first lesson

## Evidence contract

| Outcome                                                           | Executable evidence                                                                           |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ORIGINAL_SLOT_ESTABLISHED` — the starting location is known      | Monday's first lesson contains the seeded course                                              |
| `COURSE_MOVED_TO_TARGET_SLOT` — the requested edit is visible     | Tuesday's second lesson contains the seeded course                                            |
| `ORIGINAL_SLOT_CLEARED` — the course was moved rather than copied | Monday's first lesson no longer contains the seeded course                                    |
| `MOVED_SLOT_PERSISTED` — the edit survives navigation             | After leaving and reopening My Week, Tuesday's second lesson still contains the seeded course |

## State

Initial state: A configured student with a completed tutorial has one seeded course in Monday's first lesson
Final state: The seeded course is in Tuesday's second lesson
Side effects: The fixture must restore the original timetable slot before another independent run

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_entry.dart:106`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_entry.dart:125`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/schedule/schedule_entry.dart:208`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
