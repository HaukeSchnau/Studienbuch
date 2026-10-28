# anti-slop (vendored)

`src/` of [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) at `13909c9` (2026-10-13), without its tests. Upstream publishes no package and asks for the rules to be vendored. `LICENSE` is the upstream MIT notice and covers everything here except `vendor/eslint-stylistic`, which carries its own.

The copy is byte-identical, so `vp fmt` and `vp lint` skip it. To re-vendor, copy upstream `src/` over this directory, delete `*.test.ts`, and update the commit above. Rules are switched on one by one in the root `vite.config.ts`. Studienbuch's own rules, `no-throwing-errors` among them, live in `../studienbuch`.
