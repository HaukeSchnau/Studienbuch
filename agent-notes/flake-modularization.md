# Flake modularization

## Goal

Turn the root `flake.nix` into a small composition root while preserving the
existing Project Runtime, web release, and mobile development behavior.

## Scope and decisions

- `nix/project.nix` owns supported systems, per-system composition, output
  names, and Project Runtime construction.
- `nix/workspace.nix` owns the Node/pnpm toolchain, dependency-only source, and
  mutable-checkout preparation action.
- `apps/mobile/nix.nix` owns the Expo development action and Android/iOS
  toolchain policy.
- `apps/web/nix.nix` owns the web source, reproducible build, development and
  release actions, and release smoke scenario.
- `project.json` remains at the root as the Project contract.
- Supported systems are explicit: `aarch64-darwin`, `aarch64-linux`, and
  `x86_64-linux`. Current `eachDefaultSystem` also evaluates
  `x86_64-darwin`, which unstable Nixpkgs no longer supports.
- Keep explicit imports. Do not add app auto-discovery or flake-parts.
- Keep app/package-manager policy out of `nix-infra-modules`; its existing
  `lib.projectRuntime` interface is already the correct reusable seam.

## Baseline interface

- All supported systems: apps `dev`, `dev-mobile`, `dev-web`, `prepare`;
  packages `default`, `projectRuntime`; check `interface`; default dev shell.
- Linux additionally: packages `projectRelease`, `webApplication`; checks
  `projectDescriptor`, `releaseInterface`, `releasePackage`, `releaseSmoke`,
  and `webApplication`.
- `lib.project` exposes the parsed descriptor.

## Workstreams

- [x] Capture baseline output names and investigate the pinned Runtime module.
- [x] Extract workspace implementation.
- [x] Extract mobile implementation.
- [x] Extract web implementation.
- [x] Add Project composition and reduce `flake.nix`.
- [x] Simplify after behavior parity is established.
- [x] Verify Nix evaluation/builds, release smoke, and `just qa`.
- [x] Commit and push `main`.

## Verification status

- Baseline output names recorded for all three intended systems.
- Baseline `nix flake show` fails only when it reaches unsupported
  `x86_64-darwin`.
- Final output names match the baseline on all supported systems.
- Project Runtime, web application, release package, release smoke, and default
  development-shell derivation paths match the pre-refactor baseline exactly.
- `nix flake check --all-systems --no-build` passes.
- Native `nix flake check --print-build-logs` passes all 14 checks, including
  the release HTTP smoke scenario.
- The default development shell exposes Android, NDK, Java, Gradle, and
  Watchman as expected.
- `nix develop --command just qa` passes: formatting, lint, 19 tests.
- Direct `just qa` outside the development shell cannot find `vp`; this is an
  existing environment assumption, so the reproducible-shell invocation is
  the authoritative verification.

## Follow-up threshold

Reconsider extracting pnpm preparation into `nix-infra-modules` only after a
second repository demonstrates the same convention behind a small interface.
Do not extract if callers must provide fingerprint, readiness, cache, and
installation shell fragments; that would reproduce the implementation in the
interface.

## Workspace source closure (2026-08-12)

- `nix/workspace-source.nix` reads the authoritative `packages:` patterns from
  `pnpm-workspace.yaml`, discovers package manifests, and derives the local
  dependency graph across dependency, development, optional, and peer fields.
- `workspace.sourceFor packageName` produces a build source containing the
  selected package, its transitive local dependencies, root pnpm metadata,
  every workspace manifest, patches, and the shared root TypeScript config.
- Generated directories, dependency installations, and colocated `nix.nix`
  implementations are excluded by convention.
- The dependency-only source and application build sources now share the same
  workspace inventory and filtering implementation.
- `checks.workspaceSource` proves dependency-only filtering and uses mobile's
  `@stu/core` dependency to prove transitive closure. It also proves unrelated
  app source and generated output remain absent.
- Focused source-closure and real web application builds pass.
- `nix flake show --all-systems --json` and all-system no-build validation pass
  with `workspaceSource` exposed on all supported systems.
- Native `nix flake check --print-build-logs` passes all eight aarch64-linux
  checks, including the release HTTP smoke scenario and source-closure check.
- `nix develop --command just qa` passes formatting, lint, and all 19 tests.
