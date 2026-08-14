# Startup

Platforms: Android and iOS

Status: Android recorded and verified; iOS live runner recordings are required.

## Purpose

Prove that a development build with setup still incomplete reaches the license-key entry screen
after a cold app launch.

## Preconditions

- The development app `dev.schnau.studienbuch.dev` is installed and connected to its development
  bundle started with `EXPO_PUBLIC_E2E_SCENARIO=startup`.
- A cold process launch reconstructs the mock session without an accepted license key, so a prior
  run cannot influence the result.

## Actions

1. Cold-launch the application.
2. Wait for rendering and animation to become idle.

## Assertions

- The heading `Willkommen!` is visible.
- The license-key field labelled `Lizenzschlüssel` is visible.

## Recordings

- `apps/mobile/e2e/agent-device/android/startup.ad` — passed unchanged twice on a Pixel 8 API 35
  emulator hosted on the evaluation MacBook.
- `.argent/flows/android/startup.yaml` — passed unchanged twice on the same emulator and build.

Remaining iOS recordings:

- `apps/mobile/e2e/agent-device/ios/startup.ad`
- `.argent/flows/ios/startup.yaml`

Create the iOS pair from live interactions on the evaluation MacBook and pass both unchanged twice
before marking the scenario complete.
