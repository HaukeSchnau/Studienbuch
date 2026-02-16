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
MAESTRO_APP_ID=com.example.app MAESTRO_APP_LINK=studienbuch://e2e/sync-lifecycle bun --filter @stu/app-mobile maestro:test
```

## Coverage

- `sync-lifecycle-resume.yml`
  - Verifies a real background -> foreground transition triggers one lifecycle refresh signal.
- `sync-lifecycle-replay.yml`
  - Verifies queued replay state is applied after process relaunch.

## Notes

- Shared flow `shared/open-sync-lifecycle.yml` handles iOS deep-link edge cases for dev-client runs:
  - optional iOS `Open` confirmation dialog,
  - Expo launcher app selection (`Studienbuch (Dev)`),
  - Expo developer menu overlay dismissal before assertions.
- Lifecycle flows use text-based assertions/actions for reliability on the current RN/Expo accessibility tree.
