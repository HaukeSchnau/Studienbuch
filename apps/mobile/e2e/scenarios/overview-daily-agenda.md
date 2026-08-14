# Understand the current school-day agenda

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

Overview tells the student what remains in the relevant school day and distinguishes active,
upcoming, completed, and free periods.

## Example

Given the current school day contains a completed course, an active course, a free period, and an upcoming course
When the student opens Overview at the fixture time
Then the relevant school-day agenda is shown in chronological order
And every period exposes its distinct user-visible state

## Evidence contract

| Outcome                                                           | Executable evidence                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DAILY_AGENDA_IDENTIFIED` — the relevant school day is identified | `overview-agenda` and its stable relative-day label are visible                                           |
| `PERIOD_ORDER_VISIBLE` — periods are chronological                | The seeded completed, active, free, and upcoming entries appear in fixture order within `overview-agenda` |
| `ACTIVE_PERIOD_VISIBLE` — the active lesson is recognizable       | The active course exposes `active` state and a remaining-time label                                       |
| `COMPLETED_PERIOD_VISIBLE` — the completed lesson is recognizable | The completed course exposes `completed` state and its completion indicator                               |
| `FREE_PERIOD_VISIBLE` — a schedule gap is understandable          | The text `Freistunde` is visible in the seeded gap                                                        |
| `UPCOMING_PERIOD_VISIBLE` — the future lesson is actionable       | The upcoming course exposes `upcoming` state and its course destination action                            |

## State

Initial state: A configured student has the deterministic four-period agenda above, no holiday, no substitutions, and a frozen weekday time
Final state: The agenda and student data are unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/home_page.dart:25`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda.dart:35`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda_entry_view.dart:15`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
