import { expect, it } from "@effect/vitest";

import { AtlasPaths } from "./AtlasPaths.ts";

const atlas = `
<p>Source: <a href="https://git.schnau.dev/schnau/Studienbuch/src/branch/main/tools/kept.ts">kept</a>,
read by <code>packages/sync/src/Gone.ts</code>, served at <code>/api/sync</code>.</p>
<script>
const GIT = "https://git.schnau.dev/schnau/Studienbuch/src/branch/main/";
const ADR = { 1: "0001-kept", 2: "0002-gone" };
const BOXES = { sync: { t: "Sync", f: ["packages/sync/src/Kept.ts", "flake.nix"], a: [1] } };
const STEPS = [{ title: "Push", where: ["apps/server/src/Gone.ts"] }];
const link = (f) => \`<a href="\${GIT}\${f}">\${f}</a>\`;
</script>`;

const present = new Set([
  "tools/kept.ts",
  "docs/adr/0001-kept.md",
  "packages/sync/src/Kept.ts",
  "flake.nix",
]);

it("reports the linked, listed and quoted paths the tree lacks", () => {
  expect(AtlasPaths.missing(atlas, (path) => present.has(path))).toEqual([
    "apps/server/src/Gone.ts",
    "docs/adr/0002-gone.md",
    "packages/sync/src/Gone.ts",
  ]);
});
