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

Runtime preflight overrides (for deterministic local recovery during QA):

```bash
SKIP_DOCTOR=1 just live-up-dev-debug
SKIP_OCI_PRELOAD=1 just live-up-dev-debug
SKIP_DOCTOR=1 SKIP_OCI_PRELOAD=1 just live-up-dev-debug
```

Notes:

- `SKIP_DOCTOR=1` bypasses doctor checks when you already understand/accept local preflight issues.
- `SKIP_OCI_PRELOAD=1` only works when local OCI images are already present (`studienbuch-*:nix`); otherwise `just live-up-dev-debug` exits with an explicit image-missing error.

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

## iOS Mobile Smoke

Reproducible iOS lifecycle + lightweight dogfood probe:

- `tooling/qa/mobile-ios-smoke.sh`

### Run

```bash
./tooling/qa/mobile-ios-smoke.sh
# or via just:
just qa-smoke-mobile-ios
```

Include in aggregate smoke:

```bash
QA_INCLUDE_MOBILE_IOS_SMOKE=1 just qa-smoke-run
```

### Artifacts

- `.artifacts/qa/<timestamp>/mobile-ios-smoke.tsv`
- `.artifacts/qa/<timestamp>/ios-maestro-lifecycle.log`
- `.artifacts/qa/<timestamp>/ios-agent-device-*.log`

### Preconditions

- iOS simulator available and booted.
- `Studienbuch (Dev)` app installed on the simulator.
- E2E dev server running at `MOBILE_E2E_DEV_SERVER_URL` (default `http://localhost:8081`) via `bun --filter @stu/app-mobile dev:e2e`.
- `maestro` available (`maestro` or `nix run nixpkgs#maestro -- ...`).
- `agent-device` available (`agent-device`, `npx --yes agent-device`, or nix fallback).

## Android Mobile Smoke

Reproducible Android lifecycle + lightweight dogfood probe:

- `tooling/qa/mobile-android-smoke.sh`

### Run

```bash
./tooling/qa/mobile-android-smoke.sh
# or via just:
just qa-smoke-mobile-android
```

Include in aggregate smoke:

```bash
QA_INCLUDE_MOBILE_ANDROID_SMOKE=1 just qa-smoke-run
```

### Artifacts

- `.artifacts/qa/<timestamp>/mobile-android-smoke.tsv`
- `.artifacts/qa/<timestamp>/android-maestro-lifecycle.log`
- `.artifacts/qa/<timestamp>/android-adb-devices.log`
- `.artifacts/qa/<timestamp>/android-agent-device-*.log`

### Preconditions

- Android SDK `adb` available (or nix fallback: `nix shell nixpkgs#android-tools -c adb version`).
- Android emulator/device detected by `adb devices`.
- `dev.schnau.studienbuch.dev` installed on the Android target.
- E2E dev server running at `MOBILE_E2E_DEV_SERVER_URL` (default `http://localhost:8081`) via `bun --filter @stu/app-mobile dev:e2e`.
- `maestro` available (`maestro` or `nix run nixpkgs#maestro -- ...`).
- `agent-device` available (`agent-device`, `npx --yes agent-device`, or nix+android-tools fallback).
