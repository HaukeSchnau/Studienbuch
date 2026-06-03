import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;

const sourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      return sourceFiles(path);
    }
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
};

const importPattern = /from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/g;

const importsOf = (file: string) => {
  const source = readFileSync(file, "utf8");
  return Array.from(source.matchAll(importPattern), (match) => match[1] ?? match[2] ?? "");
};

const violations: string[] = [];

const report = (file: string, message: string) => {
  violations.push(`${relative(root, file)}: ${message}`);
};

for (const file of sourceFiles(join(root, "packages/core/src"))) {
  for (const specifier of importsOf(file)) {
    if (
      specifier === "react" ||
      specifier === "react-native" ||
      specifier.startsWith("expo") ||
      specifier.startsWith("~/")
    ) {
      report(file, `core must stay platform-agnostic, found ${specifier}`);
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/app"))) {
  for (const specifier of importsOf(file)) {
    if (specifier.startsWith("~/mock-app")) {
      report(file, `route files must not import mock runtime directly, found ${specifier}`);
    }
  }
}

for (const area of ["ui", "fields", "layout"]) {
  for (const file of sourceFiles(join(root, `apps/mobile/src/components/${area}`))) {
    for (const specifier of importsOf(file)) {
      if (specifier.startsWith("~/mock-app") || specifier.startsWith("~/features")) {
        report(file, `generic components must not import app data/features, found ${specifier}`);
      }
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/features"))) {
  if (!file.includes("/model/") && !file.endsWith("-model.ts")) {
    continue;
  }
  for (const specifier of importsOf(file)) {
    if (
      specifier.startsWith("~/mock-app") ||
      specifier === "react" ||
      specifier === "react-native"
    ) {
      report(file, `feature model must stay pure, found ${specifier}`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("mobile architecture boundaries ok");
