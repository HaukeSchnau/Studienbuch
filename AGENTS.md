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

## A note from Hauke

I like ambitious ideas, simple systems, and software that feels obvious. Do not preserve complexity just because it already exists. Do not introduce machinery because it looks architecturally impressive. Understand the real constraint, then fight for the smallest model that makes the correct behavior unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make changes effectively. Think of these instructions less as "hard rules", more as "good defaults". The developer's preferences should be able to override anything here.

If a rule here fights the task in front of you, say so loudly and get a human sign-off before breaking it.

Keep this document and other docs up-to-date.

## Package Roles

- `apps/mobile`: Expo mobile app. Primary customer-facing surface.
- `apps/web`: TanStack Start web app, including marketing site.
- `apps/console`: Admin/System CLI
- `packages/core`: Core Domain Model and logic. Should be completely agnostic as to where it runs (e.g. no React-specific code).

These are not set in stone. Feel free to suggest changes to these roles or adding new packages.

- `flake.nix` should provide a reproducible dev environment including all necessary dependencies needed to work in the project and be able to build the server-side packages as well as OCI containers in a reproducible fashion.
- `Justfile` is the primary entrypoint for day-to-day tasks and commands.

## Reference Repos

- T3 Code (full-stack app architecture, strong Effect v4 usage): `/home/haukeschnau/context/pingdotgg-t3code` ([upstream](https://github.com/pingdotgg/t3code))
- Legacy Flutter production app reference: `/home/haukeschnau/context/studienbuch-archive/Stubu-legacy-flutter/apps/flutter`
- Legacy React Native / Expo app reference: `/home/haukeschnau/context/studienbuch-archive/Studienbuch-Legacy/packages/app-mobile`
- Broader legacy product archive (source-oriented copy without secrets, generated files, or service data): `/home/haukeschnau/context/studienbuch-archive`
- Groundswell (event-driven local/client-to-server sync architecture): `/home/haukeschnau/context/schnau-dev-Groundswell`
- LiveStore (Expo-capable reactive SQLite and event-sourced sync comparison): `/home/haukeschnau/context/livestorejs-livestore` ([upstream](https://github.com/livestorejs/livestore))
- Expo 54 migration snapshot (intermediate native/mobile architecture): `/home/haukeschnau/context/studienbuch-archive/expo-54`
- Early event and aggregate modeling experiments: `/home/haukeschnau/context/studienbuch-archive/Experiments`

Use T3 Code as the primary reference for server/client structure and Effect-heavy app architecture. Note that we want an even more robust local-first experience and architecture than T3 Code.
When implementing or reviewing mobile UI, use the legacy Flutter app as the primary visual and behavioral reference because it is the current production app this project supersedes. Use the legacy React Native / Expo app as a secondary implementation reference.
When working on synchronization, event ingestion, replay, or client/server persistence boundaries, consult Groundswell before introducing a parallel abstraction and use LiveStore as an independent comparison point. Use the Expo 54 snapshot and experiments as historical context, not as authoritative architecture.

## Syncing and Publishing

- This is a personal repository; before starting work, always pull `main` with `jj-pull main` and pull again regularly during longer tasks.
- When work is done, commit the intended changes and push directly to `main` with `jj-push main` instead of opening a pull request.
