#!/usr/bin/env bun

import { Glob, $ } from "bun";
import p from "path";

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const glob = new Glob("{apps,packages}/*/package.json");
const packages: Map<string, Set<string>> = new Map();

// Collect all workspace packages and their dependencies
for await (const file of glob.scan(p.resolve(import.meta.dir, ".."))) {
  const pkg = (await Bun.file(file).json()) as PackageJson;
  const deps = new Set<string>();

  for (const [dep, version] of [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
  ]) {
    if (version.startsWith("workspace:") && !dep.endsWith("config")) {
      deps.add(dep);
    }
  }

  packages.set(pkg.name, deps);
}

// Generate DOT file
let dot = "digraph workspace {\n";

// Add nodes
for (const pkgName of packages.keys()) {
  dot += `  "${pkgName}";\n`;
}

dot += "\n";

// Add edges
for (const [pkgName, deps] of packages.entries()) {
  for (const dep of deps) {
    dot += `  "${pkgName}" -> "${dep}";\n`;
  }
}

dot += "}\n";

// Write to file
await Bun.write("workspace-deps.dot", dot);
console.log("Generated workspace-deps.dot");
await $`dot -Tpng workspace-deps.dot -o workspace-deps.png`;
console.log("Generated workspace-deps.png");
