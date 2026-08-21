# anti-slop (vendored)

Oxlint rules from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop), copied here rather
than depended on, because the upstream package is not published to a registry this workspace can
resolve. `LICENSE` is the upstream MIT notice and applies to everything in this directory.

Vendored 2026-08-12 via the upstream `install-anti-slop` skill; see
`agent-notes/anti-slop-integration.md` for what that migration involved.

## Local changes

The copy is not pristine, so re-vendoring is a merge rather than an overwrite:

- everything is formatted by this repository's `vp fmt`, which reflows most files;
- `shared/dictionary-types.ts` carries one semantic change so it type-checks under this
  repository's `noUncheckedIndexedAccess`.

Rules are registered in `index.ts` and enabled individually in the root `vite.config.ts`.
