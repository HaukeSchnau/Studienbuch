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

## Recordings

- `apps/mobile/e2e/agent-device/android/startup.ad` — passed unchanged twice on a Pixel 8 API 35
  emulator hosted on the evaluation MacBook.
- `.argent/flows/android/startup.yaml` — passed unchanged twice on the same emulator and build.

Remaining iOS recordings:

- `apps/mobile/e2e/agent-device/ios/startup.ad`
- `.argent/flows/ios/startup.yaml`

Create the iOS pair from live interactions on the evaluation MacBook and pass both unchanged twice
before marking the scenario complete.
