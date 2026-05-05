# AGENTS.md

## Task Completion Requirements

<!-- - All of `bun fmt`, `bun lint`, and `bun typecheck` must pass before considering tasks completed. -->

- All of `just check` must pass before considering tasks completed.
- NEVER run `bun test`. Always use `bun run test` (runs Vitest).

## Project Snapshot

<!-- T3 Code is a minimal web GUI for using coding agents like Codex and Claude. -->

Studienbuch is a local-first application for students and teachers to manage their school life.
It should work offline as much as possible, especially the mobile app.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

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
- `apps/console`: Admin CLI
- `packages/core`: Core Domain Model and logic. Should be completely agnostic as to where it runs (e.g. no React-specific code).
