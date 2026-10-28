# Agents work through pull requests

Status: accepted 2026-10-28 ([D22](https://files.schnau.dev/html/studienbuch-roadmap/#D22))

Agents no longer push to `main`. Each work package is a PR on Gitea from the agent's own jj workspace, and the agent runs `calder check` before every push. The orchestrator merges once checks pass and the preview looks right. Hauke can open any preview and never has to review code.

Every change gets a preview someone can click, multi-device sync in two browser tabs included, before it reaches beta. Parallel packages own disjoint files, so their PRs rarely conflict. The catalog in `pnpm-workspace.yaml` is append-only, and the lockfile is regenerated, never merged by hand.

Reasoning: [D22](https://files.schnau.dev/html/studienbuch-roadmap/#D22).
