import { Glob, $ } from "bun";
import p from "path";

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const projectRoot = p.resolve(import.meta.dir, "..");
const glob = new Glob("packages/*/package.json");
const packages: Map<string, Set<string>> = new Map();

for await (const file of glob.scan(projectRoot)) {
  const pkg = (await Bun.file(file).json()) as PackageJson;
  const deps = new Set<string>();

  for (const [dep, version] of [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
  ]) {
    if (version.startsWith("workspace:") && !dep.endsWith("config") && !dep.endsWith("testing")) {
      deps.add(dep);
    }
  }

  packages.set(pkg.name, deps);
}

let dot = "digraph workspace {\n";

for (const pkgName of packages.keys()) {
  dot += `  "${pkgName}";\n`;
}

dot += "\n";

for (const [pkgName, deps] of packages.entries()) {
  for (const dep of deps) {
    dot += `  "${pkgName}" -> "${dep}";\n`;
  }
}

dot += "}\n";

await Bun.write("workspace-deps.dot", dot);
console.log("Generated workspace-deps.dot");
await $`dot -Tpng workspace-deps.dot -o workspace-deps.png`;
await $`rm workspace-deps.dot`;
console.log("Generated workspace-deps.png");
