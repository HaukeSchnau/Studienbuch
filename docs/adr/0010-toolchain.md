# Toolchain

Status: accepted 2026-10-28

TypeScript 7 in every package, the Expo app included, although Expo SDK 58 still names TypeScript 6. Vite+ is the one pinned toolchain: Vite, Rolldown, Vitest, oxfmt, oxlint and tsdown come with it, and `vp` runs them. oxlint with `typeAware` and `typeCheck` is the only type checker, so there is no separate `tsc` run. `effect` and every `@effect/*` sit at one exact version in the pnpm catalog and move together, because Effect's unstable modules change in patch releases. Node 26 and pnpm 12 come from `nix/toolchain.nix`.

The versions are coupled. Each Vite+ release bundles one oxlint and tsgolint, and `@effect/tsgo` supports a narrow range of both, so a Vite+ bump must stay inside tsgo's support or the Effect rules stop loading. Expo loads `app.config.ts` through Node's type stripping under TypeScript 7, so config files use erasable syntax only.

Reasoning: [stack.md, versions](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/stack.md#part-1-versions) and [lint and type checking](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/stack.md#how-lint-and-type-checking-run).
