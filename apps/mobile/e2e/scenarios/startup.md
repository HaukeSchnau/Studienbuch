# Startup

Platforms: Android and iOS

Status: contract ready; live runner recordings are required.

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

## Recording backlog

- `apps/mobile/e2e/agent-device/android/startup.ad`
- `apps/mobile/e2e/agent-device/ios/startup.ad`
- `.argent/flows/android/startup.yaml`
- `.argent/flows/ios/startup.yaml`

These files intentionally do not exist yet: the current Linux ARM64 host has neither a connected
Android device nor an AVD, and cannot run the Nix-provided Android emulator. Create each platform's
pair from live interactions and pass both unchanged twice before marking it complete.
