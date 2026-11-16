import { expect, it } from "@effect/vitest";

import { AtlasPaths } from "./AtlasPaths.ts";

const atlas = `
<p>Source: <a href="https://git.schnau.dev/schnau/Studienbuch/src/branch/main/tools/gone.ts">gone</a>,
read by <code>packages/sync/src/Gone.ts</code>, served at <code>/api/sync</code>.</p>
<script>
const GIT = "https://git.schnau.dev/schnau/Studienbuch/src/branch/main/";
const ADR = { 1: "0001-kept", 2: "0002-gone" };
const BOXES = { sync: { t: "Sync", f: ["packages/sync/src/Kept.ts", "flake.nix"], a: [1, 29] } };
const STEPS = [{ title: "Push", where: ["apps/app/src/app/homework/[id].tsx", "apps/server/src/Gone.ts"] }];
const link = (f) => \`<a href="\${GIT}\${f}">\${f}</a>\`;
</script>`;

const present = new Set([
  "apps/app/src/app/homework/[id].tsx",
  "docs/adr/0001-kept.md",
  "packages/sync/src/Kept.ts",
  "flake.nix",
]);

it("reports the linked, listed and quoted paths the tree lacks, and unmapped ADR numbers", () => {
  expect(AtlasPaths.missing(atlas, (path) => present.has(path))).toEqual([
    "apps/server/src/Gone.ts",
    "docs/adr/0002-gone.md",
    "packages/sync/src/Gone.ts",
    "tools/gone.ts",
    "ADR 29, which the ADR map lacks",
  ]);
});
