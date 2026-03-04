# QA-001 Live Stack OCI Readiness

## Header

- Issue ID: QA-001
- Title: Live stack startup blocked by OCI preload/image readiness (`live-up-dev-debug`)
- Severity: `S2 Medium`
- Status: `Reproduced`
- Owner: Orchestrator
- Reported by: service/runtime worker
- Reported at: 2026-03-04

## Environment Stamp

- App version/build: local dev
- Git commit (app): `b1cf06ba0e3111936bb5cf086ee859a9671e7637`
- Git commit (backend, if relevant): same workspace
- Device + OS: macOS local
- Environment: `local`
- Account/tenant: n/a
- Network/region: local

## Reproduction Steps

1. Run `just live-up-dev-debug`.
2. Observe doctor preflight (port collision) and/or OCI preload failure.
3. Retry with `SKIP_DOCTOR=1 just live-up-dev-debug` and `SKIP_DOCTOR=1 SKIP_OCI_PRELOAD=1 just live-up-dev-debug`.

## Expected Result

- Live stack starts and `just live-health-all` succeeds.

## Actual Result

- OCI preload path fails (`just oci-load`) or required images are missing; stack does not become healthy.

## Artifacts

- Logs: `.artifacts/qa/20260304T223410Z/service-smoke-curl-errors.log`
- Other: subagent command logs from service/runtime slice

## Verification

### Commands Run

```bash
just qa-campaign-init
just qa-capture-run-metadata
just live-up-dev-debug
SKIP_DOCTOR=1 just live-up-dev-debug
SKIP_DOCTOR=1 SKIP_OCI_PRELOAD=1 just live-up-dev-debug
just live-health-all
just qa-smoke-services
```

### Results

- Command output summary: startup blocked before healthy runtime.
- Manual retest result: `fail`
- Verified by: Orchestrator
- Verified at: 2026-03-04

## Notes / Product Decision

- Decision needed? `no`
- Decision summary: environment/infrastructure readiness defect; diagnostics hardened in commit `qwzpntpqwvovqullsuvrpqnpwwqtnkmn`.
- Follow-up actions: repair OCI preload pipeline and re-run Phase 2 gates.
