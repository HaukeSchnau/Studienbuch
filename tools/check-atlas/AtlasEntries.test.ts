import { expect, it } from "@effect/vitest";

import { AtlasEntries } from "./AtlasEntries.ts";

const atlas = `
<script>
const DIAGRAMS = { app: { nodes: [
  { id: "a-ui", t: "UI pieces" },
  { id: "a-sync", t: "SyncClient" },
] } };
const INFO = {
  /* app */
  "a-ui": { t: "UI pieces", d: ["The design system."] },

  "a-sync": { t: "SyncClient", d: ["The device engine."] },
  "a-atoms": { t: "Atoms", d: ["Data for screens."] },

  /* server */
  pg: { t: "PostgreSQL 18", d: ["One cluster."] },
  smtp: { t: "Mail", d: ["Codes."] },
};
</script>`;

it("reports INFO entries on the line right below another entry, and nothing outside INFO", () => {
  expect(AtlasEntries.crowded(atlas)).toEqual(['"a-atoms", below "a-sync"', "smtp, below pg"]);
});

it("fails when it can't find the INFO map, so a changed declaration can't hide crowded entries", () => {
  const typed = atlas.replace(
    "const INFO = {",
    "const INFO = /** @type {Record<string, Box>} */ ({",
  );

  expect(AtlasEntries.crowded(typed)).toEqual(["INFO map not found"]);
});
