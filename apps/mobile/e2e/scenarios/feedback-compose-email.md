# Compose feedback from Profile

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

The student can start a feedback email from Profile settings with the Studienbuch recipient,
subject, and a helpful opening already prepared.

## Example

Given a configured student has opened Profile settings and an email app is available
When the student chooses Feedback
Then an email composer opens for the Studienbuch feedback address
And the feedback subject and opening text are prefilled

## Evidence contract

| Outcome                                                                      | Executable evidence                                                                                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `FEEDBACK_COMPOSER_OPENED` — the action leaves the app for email composition | The platform email composer is visible after selecting `Feedback`                                                       |
| `FEEDBACK_RECIPIENT_PREFILLED` — feedback has the correct destination        | The recipient is `studienbuch@stu.dev`                                                                                  |
| `FEEDBACK_CONTEXT_PREFILLED` — the message is recognizable as app feedback   | The subject is `Feedback zum Studienbuch` and the opening text begins with the seeded Studienbuch feedback introduction |

## State

Initial state: A configured student has Profile settings open and the test device has a deterministic email-composer handler
Final state: An unsent feedback draft is open in the platform email composer
Side effects: No email is sent; the draft may be discarded during fixture restoration

## Sources

- `flutter:Stubu-legacy-flutter/apps/flutter/lib/features/profile/top_panel.dart:35`

## Recordings

- Android — pending live agent-device and Argent recordings.
- iOS — pending live agent-device and Argent recordings.
