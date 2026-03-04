# QA-004 Android Device Missing in QA Environment

## Header

- Issue ID: QA-004
- Title: Android smoke blocked because no ADB device/emulator is detected
- Severity: `S2 Medium`
- Status: `Reproduced`
- Owner: Orchestrator
- Reported by: Android worker
- Reported at: 2026-03-04

## Environment Stamp

- App version/build: `dev.schnau.studienbuch.dev`
- Git commit (app): `5a76c49c361faefb5acd688dd56adad44ad2af9e`
- Git commit (backend, if relevant): n/a
- Device + OS: Android emulator/device unavailable
- Environment: `local`
- Account/tenant: n/a
- Network/region: local

## Reproduction Steps

1. Run `just qa-smoke-mobile-android`.
2. Inspect `adb devices` artifact output.

## Expected Result

- Android emulator/device available and smoke probe proceeds.

## Actual Result

- `android_adb_devices` fails due empty device list.

## Artifacts

- Logs:
  - `.artifacts/qa/20260304T231118Z/android-adb-devices.log`
  - `.artifacts/qa/20260304T231118Z/mobile-android-smoke.tsv`

## Verification

### Commands Run

```bash
just qa-smoke-mobile-android
```

### Results

- Command output summary: toolchain available; no connected Android target.
- Manual retest result: `fail`
- Verified by: Orchestrator
- Verified at: 2026-03-04

## Notes / Product Decision

- Decision needed? `no`
- Decision summary: environment readiness blocker, not app logic.
- Follow-up actions: provision Android emulator/device and rerun smoke.
