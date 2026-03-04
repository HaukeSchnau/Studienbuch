# QA Campaign Tracker

## Campaign Metadata

- Campaign: Full-System Verification and Fix Campaign (Subagent-Orchestrated)
- Start date: 2026-03-04
- End date: (in progress)
- Scope: Phase 1-3 gates, service/runtime smoke, web/admin smoke, console smoke, mobile iOS/Android smoke
- Orchestrator: Codex (main thread)
- Subagents: service/runtime worker, web/admin worker, iOS worker, Android worker

## Tracker

| Issue ID | Title | Severity | Status | Owner | Linked Work | Last Update | Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QA-001 | Live stack startup blocked by OCI preload/image readiness (`live-up-dev-debug`) | S2 | Reproduced | Orchestrator | `qwzpntpqwvovqullsuvrpqnpwwqtnkmn` | 2026-03-04 | Diagnose `just oci-load` invalid nix store path and restore image preload pipeline |
| QA-002 | Mobile lifecycle smoke blocked by missing E2E dev server / packager | S2 | Reproduced | Orchestrator | `.artifacts/qa/20260304T231118Z/*maestro-lifecycle.log`, `psy` | 2026-03-04 | Start `bun --filter @stu/app-mobile dev:e2e`, then rerun mobile smoke and confirm lifecycle assertions |
| QA-003 | iOS dogfood probe blocked by agent-device simulator lock (`DEVICE_IN_USE`) | S2 | Reproduced | Orchestrator | `szlmowwuyopmlmwwmovzpkptlontkzsv` | 2026-03-04 | Add session cleanup guidance and isolate conflicting session owner for stable dogfood runs |
| QA-004 | Android dogfood probe blocked: no ADB device/emulator detected | S2 | Reproduced | Orchestrator | `mqlxrmzxkrtwvutkyslqznvowtporqtw` | 2026-03-04 | Provision Android emulator in QA environment and rerun android smoke |
| QA-005 | Console help path must remain Effect-managed and DB-independent | S1 | Closed | Orchestrator | `smnprnsvwomqvrrzyrslztkoqulszpkw`, `wuuzyrrqnqmrwymwlwvpxqxmouysprrs` | 2026-03-04 | Monitor via `just qa-smoke-console` in every aggregate run |
| QA-006 | Web/admin smoke preflight diagnostics and screenshot-path reproducibility | S2 | Closed | Orchestrator | `vppplksmwwvxsmmsszytsvmzuzqmxwus` | 2026-03-04 | Keep in aggregate smoke (`QA_INCLUDE_WEB_ADMIN_SMOKE=1`) |
| QA-007 | Service smoke curl failure handling produced ambiguous HTTP code behavior | S2 | Closed | Orchestrator | `qwzpntpqwvovqullsuvrpqnpwwqtnkmn` | 2026-03-04 | Keep `service-smoke-curl-errors.log` review in smoke triage |

## Backlog States (Use Exact Labels)

- New
- Reproduced
- Product Decision Needed
- Fix In Progress
- In Review
- Verified
- Closed
- Deferred

## Status Buckets

### Reproduced

- [ ] QA-001: Live stack startup blocked by OCI preload/image readiness
- [ ] QA-002: Mobile lifecycle smoke blocked by missing E2E dev server / packager
- [ ] QA-003: iOS dogfood probe blocked by `DEVICE_IN_USE`
- [ ] QA-004: Android dogfood probe blocked by missing device/emulator

### Closed

- [x] QA-005: Console help path fixed (Effect-managed)
- [x] QA-006: Web/admin smoke hardened
- [x] QA-007: Service smoke diagnostics hardened
