# Anti-slop integration

## Goal

Integrate `dmmulroy/anti-slop` into the repository's Vite+ lint configuration.

## Current state (2026-08-12)

- Pulled `main` and created the active Jujutsu change `wip: integrate anti-slop lint rules`.
- Installed the upstream `install-anti-slop` skill and copied its bundled plugin to
  `tools/oxlint/anti-slop/`.
- Added root dev dependencies `oxlint@1.78.0` and `@oxlint/plugins@1.78.0`.
- Registered the plugin in root `vite.config.ts` and enabled all ten rules as errors.
- Ignored the project-local `.pnpm-store/` required by the Nix development environment.
- `just test` passes: 16 files, 45 tests.
- `just lint` fails with 66 anti-slop findings and 16 TypeScript diagnostics. Rule totals:
  - 16 `no-known-value-widening`
  - 16 `no-runtime-typeof`
  - 16 `no-shape-in-symbol-names`
  - 13 `no-unknown-parameters`
  - 2 `no-conditional-empty-object-spread`
  - 2 `no-unsafe-dictionary-type`
  - 1 `no-object-parameters`
- One TypeScript diagnostic is inside the copied plugin at
  `shared/dictionary-types.ts:210`; the remainder are existing project diagnostics exposed by
  the current Oxlint/type-aware run.

## Decision

The user approved the full migration on 2026-08-12. Keep all rules enabled at error severity and
do not use suppressions, unsafe casts, or weakened contracts to satisfy them.

## Work packets

- `P1` root/tooling dependencies: root config, lockfile, app dependency declarations, copied
  plugin compatibility fix. Must complete before source packets validate.
- `P2` mobile: observability boundary schemas, closed registries/features, and safe aliases for
  upstream Expo APIs whose names contain the forbidden term. Preserve partial outbox recovery,
  widget isolation, and platform UI behavior.
- `P3` web: server error boundaries, SSR/browser capability checks, telemetry owner contracts,
  and tests.
- `P4` shared/Node: core registries, observability contracts, Node address decoding, and script
  error-channel typing.

`P2`, `P3`, and `P4` have non-overlapping source ownership and can run in parallel after `P1`.

## Next steps

1. Integrate the completed `P1`–`P4` packets and resolve any residual diagnostics.
2. Run `just qa` until green and perform final React diagnostics.
3. Simplify and review the complete diff.
4. Commit the active Jujutsu change with a detailed message, pull `main` again,
   and push directly to `main`.

## Packet verification (2026-08-12)

- `P1`: copied plugin lint passes; direct dependency declarations installed.
- `P2`: mobile lint passes; 22 tests pass; Expo public config resolves.
- `P3`: web lint passes; 21 tests pass; client/SSR production build passes.
- `P4`: scoped lint passes; core 5 tests, observability 9 tests, console 4 tests pass.
- Integrated `just qa` passes: formatting, lint/type-aware checks, and 61 tests.
- React Doctor comparison: mobile improved from 47/100 (82 findings) to 48/100 (79 findings);
  web remained 48/100 (23 findings). No regression was introduced.
- The vendored plugin includes the upstream MIT license notice and is formatted by the repository's
  formatter. A minimal semantic compatibility change in `shared/dictionary-types.ts` handles this
  repo's strict indexed-access type checking.
