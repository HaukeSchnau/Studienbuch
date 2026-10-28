# Restart in place

Status: accepted 2026-10-28 ([D3](https://files.schnau.dev/html/studienbuch-roadmap/#D3))

Studienbuch is rewritten from scratch in the same repository and on the same `main`. The old tree stays at the bookmark `legacy-2026-10` (`de2dee6b1`). Nothing carries over without review: each design re-decided its area, and code, rules and docs come back only when a design says so. The repository keeps its history, remotes and contributor setup, and the review gate keeps old decisions from returning by inertia.

The clearing commit removed `apps/mobile`, `apps/console` (now a server command), `apps/worker` (now the jobs role), `packages/server` (now in `apps/server`), `packages/observability`, the Project SDK wiring, the Justfile, the second lockfile, the paired E2E runners, `schemas/` and `scripts/`. It kept the licence files, `CONTRIBUTING.md`, `branding/`, the CLA workflow for the GitHub mirror, and the legacy behavior catalogue with its scenario contracts.

Reasoning: [architecture.md, repo layout](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/architecture.md#repo-layout).
