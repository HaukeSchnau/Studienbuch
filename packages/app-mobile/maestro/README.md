# Maestro E2E

## Prerequisites

1. Install dev shell dependencies once:

```bash
nix develop
```

`maestro` is provided by `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch/flake.nix`, so project scripts can call it directly.

2. Ensure a simulator/emulator is running and the development app (`dev.schnau.studienbuch.dev`) is installed.
3. Start Metro in E2E mode so the `/e2e/*` routes are available:

```bash
bun --filter @stu/app-mobile dev:e2e
```

## Run

All flows:

```bash
bun test:maestro:mobile
```

Lifecycle-only suite:

```bash
bun --filter @stu/app-mobile maestro:test:lifecycle
```

Override app config (optional):

```bash
bun --filter @stu/app-mobile maestro:test -- -e MAESTRO_APP_ID=com.example.app -e MAESTRO_APP_LINK=studienbuch://e2e/sync-lifecycle
```

## Coverage

- `sync-lifecycle-resume.yml`
  - Verifies a real background -> foreground transition triggers one lifecycle refresh signal.
- `sync-lifecycle-replay.yml`
  - Verifies queued replay state is applied after process relaunch.
