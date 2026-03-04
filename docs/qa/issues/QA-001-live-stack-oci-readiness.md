# QA-001 Live Stack OCI Readiness

## Header

- Issue ID: QA-001
- Title: Live stack startup blocked by OCI preload/image readiness (`live-up-dev-debug`)
- Severity: `S2 Medium`
- Status: `Closed`
- Owner: Orchestrator
- Reported by: service/runtime worker
- Reported at: 2026-03-04

## Environment Stamp

- App version/build: local dev
- Git commit (app): `1dae6f5226892cfb9ef1d676aa592c92eb50594a`
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

- Logs:
  - `.artifacts/qa/20260304T232737Z/QA-001/just-oci-load.log`
  - `.artifacts/qa/20260304T232737Z/QA-001/live-up-dev-debug.log`
  - `.artifacts/qa/20260304T232737Z/QA-001/live-health-all.log`
  - `.artifacts/qa/20260304T232737Z/QA-001/qa-smoke-services.log`
- Other: subagent command logs from service/runtime slice

## Verification

### Commands Run

```bash
just qa-campaign-init
just qa-capture-run-metadata
just oci-load
just live-up-dev-debug
SKIP_DOCTOR=1 just live-up-dev-debug
SKIP_DOCTOR=1 SKIP_OCI_PRELOAD=1 just live-up-dev-debug
just live-health-all
just qa-smoke-services
```

### Results

- Command output summary: `oci-load`, `live-up-dev-debug`, `live-health-all`, and `qa-smoke-services` all pass after fallback fix.
- Manual retest result: `pass`
- Verified by: Orchestrator
- Verified at: 2026-03-04

## Notes / Product Decision

- Decision needed? `no`
- Decision summary: fixed via resilient OCI archive resolution with local fallback when Nix cache path-info is unavailable.
- Follow-up actions: monitor in daily smoke and keep fallback archive directory populated (`.artifacts/oci` or `STUDIENBUCH_OCI_ARCHIVE_DIR`).
