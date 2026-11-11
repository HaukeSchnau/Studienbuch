// Fails when docs/architecture/atlas.html names a repository path that doesn't exist in this tree.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import { AtlasPaths } from "./AtlasPaths.ts";

const root = NodePath.resolve(import.meta.dirname, "../..");
const atlas = "docs/architecture/atlas.html";

const html = NodeFS.readFileSync(NodePath.join(root, atlas), "utf8");
const missing = AtlasPaths.missing(html, (path) => NodeFS.existsSync(NodePath.join(root, path)));

if (missing.length > 0) {
  console.error(
    [
      `${atlas} names ${missing.length} path${missing.length === 1 ? "" : "s"} that no longer exist:`,
      ...missing.map((path) => `  ${path}`),
      "Update the atlas in the same change that moved or removed them.",
    ].join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(`${atlas}: all ${AtlasPaths.referenced(html).length} paths exist.`);
}
