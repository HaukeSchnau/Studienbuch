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
bun run typecheck
bun run test
bun run ci
```

Package-targeted examples:

```bash
bun --filter @stu/api typecheck
bun --filter @stu/db test:live -- src/applicators.live.integration.test.ts
bun --filter @stu/app-mobile maestro:test:lifecycle
```

## Turbo Task Model

`turbo.json` defines shared task semantics:
- `build`: cached outputs (`dist/**`, tsbuildinfo)
- `typecheck`: depends on transitive `build` and `topo`
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
