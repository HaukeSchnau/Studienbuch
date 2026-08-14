# Distinguish non-actionable agenda periods

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Overview renders a gap between scheduled lessons as a free period and prevents a completed lesson
from behaving like an upcoming course destination.

## Example

Given today's seeded agenda contains a completed lesson, a free period, and an upcoming lesson
When the student reviews the settled agenda
Then the schedule gap is labelled as a free period
And only the upcoming lesson exposes an action to open its course

## Evidence contract

| Outcome                                                                            | Executable evidence                                                                |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `FREE_PERIOD_VISIBLE` — the timetable gap is explained                             | The text `Freistunde` is visible between the seeded completed and upcoming lessons |
| `COMPLETED_LESSON_IDENTIFIED` — the finished lesson has a stable state             | The seeded completed lesson exposes `completed` state and its completion indicator |
| `COMPLETED_LESSON_NON_ACTIONABLE` — finished work cannot navigate as upcoming work | The seeded completed lesson exposes no course-destination action                   |
| `UPCOMING_LESSON_ACTIONABLE` — the comparison action remains available             | The seeded upcoming lesson exposes its course-destination action                   |

## State

Initial state: A configured student has the deterministic three-period agenda above, no holiday, no substitutions, and a frozen weekday time
Final state: The agenda remains visible and application data is unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda.dart:49`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda_entry_view.dart:15`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda_entry_view.dart:88`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda_entry_view.dart:99`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
