/// <reference types="node" />
// Runs after `expo export` (the `build:web` script): writes the release's files and a version
// computed from their contents into dist/sw.js (public/sw.js says why).

import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const dist = NodePath.join(import.meta.dirname, "dist");
const worker = NodePath.join(dist, "sw.js");
const placeholder = '"__PRECACHE__"';

// The worker itself is fetched past any service worker, and `metadata.json` is for native updates.
const skipped = new Set(["sw.js", "metadata.json"]);

const files = NodeFS.readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) =>
    NodePath.relative(dist, NodePath.join(entry.parentPath, entry.name))
      .split(NodePath.sep)
      .join("/"),
  )
  .filter((file) => !skipped.has(file))
  .sort();

const hash = NodeCrypto.createHash("sha256");

for (const file of files) {
  hash.update(`${file}\0`).update(NodeFS.readFileSync(NodePath.join(dist, file)));
}

const source = NodeFS.readFileSync(worker, "utf8");

if (source.includes(placeholder)) {
  const release = { version: hash.digest("hex").slice(0, 16), files };

  NodeFS.writeFileSync(worker, source.replace(placeholder, JSON.stringify(release)));
  console.log(`sw.js keeps ${files.length} files of release ${release.version}`);
} else {
  console.error(`${worker} has no ${placeholder} to fill in.`);
  process.exitCode = 1;
}
