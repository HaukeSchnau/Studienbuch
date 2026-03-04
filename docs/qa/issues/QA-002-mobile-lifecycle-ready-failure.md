# QA-002 Mobile Lifecycle Ready Failure

## Header

- Issue ID: QA-002
- Title: Mobile lifecycle Maestro flows fail at `assertVisible: "ready"` (iOS + Android)
- Severity: `S1 High`
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

- Maestro lifecycle flows pass on configured platform(s).

## Actual Result

- All lifecycle flows fail with `Assertion is false: "ready" is visible`.

## Artifacts

- Logs:
  - `.artifacts/qa/20260304T231118Z/ios-maestro-lifecycle.log`
  - `.artifacts/qa/20260304T231118Z/android-maestro-lifecycle.log`

## Verification

### Commands Run

```bash
just qa-smoke-mobile-ios
just qa-smoke-mobile-android
```

### Results

- Command output summary: lifecycle suite fails consistently at `ready` assertion.
- Manual retest result: `fail`
- Verified by: Orchestrator
- Verified at: 2026-03-04

## Notes / Product Decision

- Decision needed? `no`
- Decision summary: likely runtime/e2e harness state defect; requires focused repro-first fix loop.
- Follow-up actions: instrument E2E entry route and add failing regression test where feasible.
