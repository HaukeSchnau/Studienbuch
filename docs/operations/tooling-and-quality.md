# Tooling and Quality Gates

## Workspace Tooling Packages

- `@stu/tailwind-config` (`tooling/tailwind`): shared Tailwind presets for web/native.
- `@stu/testing` (`tooling/testing`): shared Vitest config and mocks.
- `@stu/tsconfig` (`tooling/typescript`): shared TypeScript base and package config presets.

## Utility Scripts

- `tooling/doctor.sh`: preflight validation used by `just doctor`.
- `tooling/with-env.sh`: executes commands with `.env` / `.env.secrets` context.
- `tooling/visualize-deps.ts`: regenerates workspace dependency diagram.

## Quality Commands

Root-level:

```bash
bun run lint
bun run checks:lint:ci
bun run test
bun run ci
```

Package-targeted examples:

```bash
bun --filter @stu/api lint
bun --filter @stu/db test:live -- src/applicators.live.integration.test.ts
bun --filter @stu/app-mobile maestro:test:lifecycle
```

## Turbo Task Model

`turbo.json` defines shared task semantics:

- `build`: cached outputs (`dist/**`, tsbuildinfo)
- `lint`: workspace lint task (type-aware checks via `oxlint`)
- `test`: depends on transitive `build`
- `dev`/`dev:internal`: non-cached watch workflows

## Nix-First Fallback

If a required command is missing locally, run via Nix.

Examples:

```bash
nix run nixpkgs#jq -- --version
nix run nixpkgs#graphviz -- -V
nix shell nixpkgs#cloc -c cloc .
```

## Web/Admin Agent-Browser Smoke

Reproducible navigation smoke for public/login/admin guard checks lives in:

- `tooling/qa/web-admin/smoke-navigation.sh`

### Preconditions

- Web stack is running and reachable (for local dev: `just live-up-dev`).
- `agent-browser` is installed (`agent-browser --help`) or runnable via `npx`.
- Base URL is reachable (defaults to `http://localhost:${STU_NEXTJS_PORT:-3000}`).

### Run

```bash
./tooling/qa/web-admin/smoke-navigation.sh
# or via just:
just qa-smoke-web-admin
```

Override base URL or artifact location when needed:

```bash
WEB_BASE_URL=http://localhost:3000 ./tooling/qa/web-admin/smoke-navigation.sh
ARTIFACT_ROOT=$PWD/.artifacts/qa/web-admin-smoke ./tooling/qa/web-admin/smoke-navigation.sh
```

### Artifacts

Each run writes artifacts under (by default):

- `.artifacts/qa/web-admin-smoke/<timestamp>/`

Key outputs:

- `run.log`: command-level execution log.
- `summary.tsv`: per-check PASS/FAIL summary.
- `preconditions.txt`: captured assumptions for the run.
- `<check>/` directories (`public-home`, `login-page`, `admin-guard`) with URL/title/body/snapshot/screenshot captures.
