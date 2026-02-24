# @stu/testing

Shared test utilities and Vitest setup for workspace packages.

## Responsibilities

- Provide a common Vitest config for cross-package tests.
- Provide test mocks (for example external API mock fixtures).
- Centralize DB test setup wiring used in integration suites.

## Key Files

- `vitest.config.ts`: shared Vitest config.
- `__mocks__/@stu/external-api.ts`: mock holiday data.

## Usage

Import this package in workspace tests where shared setup or mocks are required.

## Scripts

This package does not currently define package-local scripts. Use workspace-level checks (`bun run lint`, `bun run typecheck`, `bun run test`).
