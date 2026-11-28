// Fails when docs/architecture/atlas.html names a repository path that doesn't exist in this tree,
// cites an ADR number its ADR map lacks, puts two INFO entries on neighbouring lines, or has a
// script that doesn't compile.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { AtlasEntries } from "./AtlasEntries.ts";
import { AtlasPaths } from "./AtlasPaths.ts";
import { AtlasScripts } from "./AtlasScripts.ts";

const root = NodePath.resolve(import.meta.dirname, "../..");
const atlas = "docs/architecture/atlas.html";

const html = NodeFS.readFileSync(NodePath.join(root, atlas), "utf8");
const missing = AtlasPaths.missing(html, (path) => NodeFS.existsSync(NodePath.join(root, path)));
const crowded = AtlasEntries.crowded(html);
const unparsable = AtlasScripts.unparsable(html);

if (missing.length > 0) {
  console.error(
    [
      `${atlas} names ${missing.length} path${missing.length === 1 ? "" : "s"} or ADR${missing.length === 1 ? "" : "s"} that don't exist:`,
      ...missing.map((path) => `  ${path}`),
      "Update the atlas in the same change that moved or removed them.",
    ].join("\n"),
  );
  process.exitCode = 1;
}

if (crowded.length > 0) {
  console.error(
    [
      `${atlas} fails the INFO layout check:`,
      ...crowded.map((entry) => `  ${entry}`),
      "Each INFO entry is one line with a blank line above it, so two changes to neighbouring boxes",
      "merge cleanly. The check finds the map by its lines `const INFO = {` and `};`.",
    ].join("\n"),
  );
  process.exitCode = 1;
}

if (unparsable.length > 0) {
  console.error(
    [
      `${atlas} fails the script check, and a script that doesn't compile draws nothing:`,
      ...unparsable.map((error) => `  ${error}`),
    ].join("\n"),
  );
  process.exitCode = 1;
}

if (missing.length === 0 && crowded.length === 0 && unparsable.length === 0) {
  console.log(`${atlas}: all ${AtlasPaths.referenced(html).length} paths exist.`);
}
