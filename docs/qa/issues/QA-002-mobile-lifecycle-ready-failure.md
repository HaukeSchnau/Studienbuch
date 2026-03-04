# QA-002 Mobile Lifecycle E2E Dev-Server Readiness

## Header

- Issue ID: QA-002
- Title: Mobile lifecycle smoke blocked by missing E2E dev server / packager
- Severity: `S2 Medium`
- Status: `Reproduced`
- Owner: Orchestrator
- Reported by: iOS/Android workers
- Reported at: 2026-03-04

## Environment Stamp

- App version/build: dev app (`Studienbuch (Dev)` / `dev.schnau.studienbuch.dev`)
- Git commit (app): `77d528756b90d6606269b0f90def4cce14cebd25`, `5a76c49c361faefb5acd688dd56adad44ad2af9e`
- Git commit (backend, if relevant): current workspace stack
- Device + OS: iOS simulator present; Android device absent
- Environment: `local`
- Account/tenant: e2e route
- Network/region: local

## Reproduction Steps

1. Run `just qa-smoke-mobile-ios`.
2. Run `just qa-smoke-mobile-android`.
3. Inspect lifecycle logs.

## Expected Result

- E2E dev server is available and Maestro lifecycle flows run against the app runtime.

## Actual Result

- App remains on Expo Dev Launcher without packager; lifecycle assertions fail.

## Artifacts

- Logs:
  - `.artifacts/qa/20260304T231118Z/ios-maestro-lifecycle.log`
  - `.artifacts/qa/20260304T231118Z/android-maestro-lifecycle.log`
  - `~/.maestro/tests/2026-03-05_001422/commands-(Sync lifecycle resume refresh).json` (contains `Unable to find any packagers`)

## Verification

### Commands Run

```bash
just qa-smoke-mobile-ios
just qa-smoke-mobile-android
MOBILE_E2E_DEV_SERVER_URL=http://localhost:8081 just qa-smoke-mobile-ios
MOBILE_E2E_DEV_SERVER_URL=http://localhost:8081 just qa-smoke-mobile-android
```

### Results

- Command output summary: mobile smoke now fails fast when E2E dev server is unavailable (`http://localhost:8081`).
- Manual retest result: `fail`
- Verified by: Orchestrator
- Verified at: 2026-03-04

## Notes / Product Decision

- Decision needed? `no`
- Decision summary: environment readiness defect first; app-level lifecycle behavior remains unverified until packager is running.
- Follow-up actions: start `bun --filter @stu/app-mobile dev:e2e` and rerun mobile smoke before opening app-logic defect loop.
