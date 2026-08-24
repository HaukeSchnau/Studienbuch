# Production foundation

## Goal

Establish the first production persistence and mobile operations foundation without introducing
sync or event sourcing.

## Scope

- PostgreSQL through `@effect/sql-pg` and Drizzle's Effect-native driver
- one Drizzle migration history, initially containing Better Auth's required tables
- Better Auth persistence plus its Expo client using SecureStore and network awareness
- a real Testcontainers PostgreSQL integration test using `@effect/vitest`
- Legend List in a real mobile list
- privacy-conscious React Native Sentry crash reporting and source-map configuration
- A repository-pinned, paired Argent and agent-device mobile E2E evaluation harness

## Architectural decisions

- `packages/server` owns server-only persistence. `packages/core` remains runtime-agnostic.
- PostgreSQL stores current authoritative state only. No event log, replication protocol, or sync
  abstraction is part of this change.
- Drizzle's Effect driver is used by application workflows. Better Auth uses its supported `pg`
  interface against the same pool and schema because its Drizzle adapter currently peers on the
  stable Drizzle line while Effect support is on Drizzle 1.0 RC. The pinned RC 5 preview includes
  the Effect RC 108 compatibility fixes that RC 4 lacked.
- Domain tables wait for their first server use case; the initial schema does not speculate about
  them.

## Verification status

- Complete: `just qa` (all six workspaces; PostgreSQL Testcontainers test included)
- Complete: `expo install --check` and public Expo config evaluation
- Complete: production web build
- Complete: `nix build .#webApplication`
- Complete: Nix project descriptor and release smoke checks, including runtime startup against an
  ephemeral PostgreSQL 17 server
- Complete: Argent 0.20.0 and agent-device 0.20.8 install from the project lockfile; the paired
  comparison harness validates implementation parity before running either tool

## Production web dependency graph

- `pnpm-lock.web.yaml` is a generated, deployment-specific graph for the web app and its three
  internal runtime workspaces. Regenerate it with `just web-lock`; `just qa` checks it with the
  pinned CI toolchain.
- The release graph remains subordinate to `pnpm-lock.yaml`: generation seeds resolution from the
  primary lock, and validation rejects package versions that do not exist in it.
- `nix/web-pnpmfile.cjs` removes the optional native Expo peers exposed by `@better-auth/expo` from
  this server-only graph. Mobile still uses the package's unmodified metadata and dependencies.
- On the `aarch64-linux` deployment target, pnpm fetches only native packages for that target. The
  resulting fixed-output dependency store is 154.8 MiB, down from roughly 1.7 GiB; the release
  runtime closure is 259.2 MiB.

## Follow-up tasks

- Supply `databaseUrl` alongside `betterAuthSecret` in each deployed project runtime.
- Set `SENTRY_ORG`, `SENTRY_PROJECT`, and secret `SENTRY_AUTH_TOKEN` in EAS before the first release
  that should upload native source maps; set `EXPO_PUBLIC_SENTRY_DSN` to enable capture.
- Record and run both implementations of the startup scenario on an Android device/emulator and an
  iOS simulator/device; the current Linux ARM64 host cannot provide either live authoring target.
- Add the first domain schema only with its first server workflow.
