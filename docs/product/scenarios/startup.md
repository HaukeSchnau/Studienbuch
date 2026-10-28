# Route incomplete setup to activation

Status: accepted
Platforms: Android, iOS
Confidence: established

## Rule

A student who has not completed setup reaches activation instead of entering the main application.

## Example

Given the app has no accepted licence key
When the student cold-launches the app
Then the welcome screen is shown
And a licence key can be entered

## Evidence contract

| Outcome                               | Executable evidence                             |
| ------------------------------------- | ----------------------------------------------- |
| The activation destination is reached | The heading `Willkommen!` is visible            |
| The screen is ready for input         | The field labelled `Lizenzschlüssel` is visible |

## State

Initial state: Setup is incomplete and no licence key has been accepted
Final state: Setup remains incomplete
Side effects: None

## Sources

- `current:apps/mobile/src/features/setup/screens/license-key-screen.tsx:45`
