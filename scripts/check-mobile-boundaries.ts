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

const oldComponentEntrypoints = new Set([
  "bottom-sheet",
  "button",
  "card",
  "checkbox-row",
  "confirm-page-content",
  "core-layout",
  "date-field",
  "divider",
  "field-surface",
  "icon-button",
  "page-scaffold",
  "select-field",
  "sheet-callout",
  "sheet-scaffold",
  "system-icon",
  "table",
  "temp-error",
  "text",
  "text-area-field",
  "text-field",
]);

const featureNameFromPath = (file: string) => {
  const normalized = relative(join(root, "apps/mobile/src/features"), file);
  const [featureName] = normalized.split("/");
  return featureName;
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
    if (specifier.startsWith("@stu/core")) {
      report(file, `route files should parse params through app-shell, found ${specifier}`);
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src"))) {
  for (const specifier of importsOf(file)) {
    const oldComponent = specifier.match(/^~\/components\/([^/]+)$/)?.[1];
    if (oldComponent && oldComponentEntrypoints.has(oldComponent)) {
      report(file, `use canonical component import folders instead of ${specifier}`);
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
  const currentFeature = featureNameFromPath(file);

  if (!file.includes("/model/") && !file.endsWith("-model.ts")) {
    for (const specifier of importsOf(file)) {
      if (specifier === "~/mock-app/provider") {
        report(file, "features must use narrow mock hooks, not the provider");
      }

      const featureImport = specifier.match(/^~\/features\/([^/]+)(?:\/(.+))?$/);
      if (!featureImport) {
        continue;
      }

      const [, importedFeature, rest] = featureImport;
      if (importedFeature === currentFeature) {
        continue;
      }

      const isPublicFeatureImport = !rest || specifier === "~/features/courses/grades";
      if (!isPublicFeatureImport) {
        report(file, `cross-feature import must use a public feature barrel, found ${specifier}`);
      }
    }
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
