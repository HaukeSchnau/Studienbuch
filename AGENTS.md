# AGENTS.md

## Task Completion Requirements

- All of `just qa` must pass before considering tasks completed.
- Run tests with `just test` or a relevant package's test script when targeting one workspace.

## Project Snapshot

Studienbuch is a local-first application for students and teachers to manage their school life.
It should work offline as much as possible, especially the mobile app.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

I'm willing to use bleeding edge tech, even if it's alpha or experimental.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Offline/local first.
4. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `apps/mobile`: Expo mobile app. Primary customer-facing surface.
- `apps/web`: TanStack Start web app, including marketing site.
- `apps/console`: Admin/System CLI
- `packages/core`: Core Domain Model and logic. Should be completely agnostic as to where it runs (e.g. no React-specific code).

These are not set in stone. Feel free to suggest changes to these roles or adding new packages.

- `flake.nix` should provide a reproducible dev environment including all necessary dependencies needed to work in the project and be able to build the server-side packages as well as OCI containers in a reproducible fashion.
- `Justfile` is the primary entrypoint for day-to-day tasks and commands.

## Reference Repos

- T3 Code (full-stack app architecture, strong Effect v4 usage): https://github.com/pingdotgg/t3code
- Legacy Flutter production app reference: `/Users/haukeschnau/urbs/Products/Studienbuch/Stubu-legacy-flutter/apps/flutter`
- Legacy React Native / Expo app reference: `/Users/haukeschnau/urbs/Products/Studienbuch/Studienbuch-Legacy/packages/app-mobile`
- Broader legacy product archive: `/Users/haukeschnau/urbs/Products/Studienbuch`

Use T3 Code as the primary reference for server/client structure and Effect-heavy app architecture. Note that we want an even more robust local-first experience and architecture than T3 Code.
When implementing or reviewing mobile UI, use the legacy Flutter app as the primary visual and behavioral reference because it is the current production app this project supersedes. Use the legacy React Native / Expo app as a secondary implementation reference.

## Syncing and Publishing

- This is a personal repository; before starting work, always pull `main` with `jj-pull main` and pull again regularly during longer tasks.
- When work is done, commit the intended changes and push directly to `main` with `jj-push main` instead of opening a pull request.
