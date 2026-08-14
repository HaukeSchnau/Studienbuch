# Explain a timetable substitution on Overview

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A timetable change remains anchored to its scheduled lesson while clearly naming the kind of
substitution and the affected course or teacher.

## Example

Given today's agenda contains a seeded cancelled lesson and a seeded teacher substitution
When the student opens Overview
Then each affected lesson names its substitution type
And the replaced course or teacher is visibly marked as changed

## Evidence contract

| Outcome                                                               | Executable evidence                                                          |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `CANCELLATION_EXPLAINED` — the cancelled lesson is understandable     | The seeded lesson exposes `cancelled` state and the text `Entfall`           |
| `SUBSTITUTION_EXPLAINED` — the teacher change is understandable       | The seeded teacher row exposes `substituted` state and the text `Vertretung` |
| `SCHEDULE_CONTEXT_PRESERVED` — each change remains tied to its lesson | Both affected rows retain their seeded scheduled times and course identities |

## State

Initial state: A configured student has a deterministic current-day agenda with one cancellation and one teacher substitution
Final state: Agenda and substitution data are unchanged
Side effects: None

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda_entry_view.dart:70`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/agenda/agenda_entry_view.dart:112`
- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/substitutions/substitution.dart:17`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
