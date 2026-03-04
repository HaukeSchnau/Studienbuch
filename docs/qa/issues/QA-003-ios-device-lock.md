# QA-003 iOS Device Lock During Dogfood Probe

## Header

- Issue ID: QA-003
- Title: iOS dogfood probe blocked by `DEVICE_IN_USE` from another agent-device session
- Severity: `S2 Medium`
- Status: `Reproduced`
- Owner: Orchestrator
- Reported by: iOS worker
- Reported at: 2026-03-04

## Environment Stamp

- App version/build: `Studienbuch (Dev)` on simulator
- Git commit (app): `77d528756b90d6606269b0f90def4cce14cebd25`
- Git commit (backend, if relevant): n/a
- Device + OS: iOS simulator
- Environment: `local`
- Account/tenant: n/a
- Network/region: local

## Reproduction Steps

1. Run `just qa-smoke-mobile-ios` while another agent-device session holds simulator.
2. Observe open command failure in log.

## Expected Result

- Probe opens app and takes snapshot in isolated session.

## Actual Result

- Open fails with `Error (DEVICE_IN_USE): Device is already in use by session "default"`.

## Artifacts

- Logs:
  - `.artifacts/qa/20260304T231118Z/ios-agent-device-open.log`

## Verification

### Commands Run

```bash
just qa-smoke-mobile-ios
```

### Results

- Command output summary: deterministic failure message captured.
- Manual retest result: `fail`
- Verified by: Orchestrator
- Verified at: 2026-03-04

## Notes / Product Decision

- Decision needed? `no`
- Decision summary: environment/session contention issue; script now reports explicit lock state.
- Follow-up actions: ensure exclusive agent-device session ownership before dogfood run.
