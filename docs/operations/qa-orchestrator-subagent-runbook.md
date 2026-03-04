# QA Orchestrator/Subagent Runbook

This runbook keeps QA campaigns fast, traceable, and low-noise.

## Roles

- Orchestrator: owns campaign tracker, prioritization, assignment, and final state transitions.
- Subagent: executes tests, files issues, verifies fixes, and reports evidence.

## Workflow

1. Orchestrator opens campaign tracker from [`docs/qa/campaign-tracker-template.md`](../qa/campaign-tracker-template.md) and sets scope, owners, and dates.
2. Orchestrator assigns issue IDs and test slices to subagents.
3. Subagent tests assigned slice and creates issues from [`docs/qa/issue-template.md`](../qa/issue-template.md).
4. Orchestrator triages each issue into one of: `Reproduced`, `Product Decision Needed`, or `Deferred`.
5. During implementation, orchestrator updates status to `Fix In Progress` and then `In Review`.
6. Subagent verifies merged fixes with explicit commands + result evidence, then proposes `Verified` or bounces back with new repro.
7. Orchestrator closes loop: `Verified -> Closed` (or back to `Reproduced` if regression persists).

## Handoff Contract

Every update must include:

- Issue ID + status
- What changed since last update
- Evidence link(s) (artifact, logs, PR, commit)
- Next action + owner

## Operating Cadence

- Start of day: orchestrator reorders backlog by severity and blocker risk.
- Mid-day sync: clear `Product Decision Needed` items first.
- End of day: ensure every non-closed item has owner + next action.

## Exit Criteria

- All in-scope issues are `Closed` or explicitly `Deferred`.
- Every `Closed` issue has verification commands and recorded results.
- Tracker has no stale rows (missing owner, missing next action, or missing evidence).
