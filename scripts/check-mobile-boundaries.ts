import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
  "confirmation-status",
  "core-layout",
  "date-field",
  "divider",
  "field-surface",
  "icon-button",
  "page-scaffold",
  "select-field",
  "select-course",
  "sheet-callout",
  "sheet-scaffold",
  "signature-field",
  "subject-icon",
  "system-icon",
  "table",
  "temp-error",
  "text",
  "text-area-field",
  "text-field",
]);

const forbiddenMobileSourceDirs = [
  "apps/mobile/src/mock-app",
  "apps/mobile/src/navigation",
  "apps/mobile/src/utils",
  "apps/mobile/src/features/agenda",
  "apps/mobile/src/features/grades",
];

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

for (const dir of forbiddenMobileSourceDirs) {
  const path = join(root, dir);
  if (existsSync(path)) {
    violations.push(`${dir}: remove obsolete mobile source directory`);
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/app"))) {
  for (const specifier of importsOf(file)) {
    if (specifier.startsWith("~/data")) {
      report(file, `route files must not import app data directly, found ${specifier}`);
    }
    if (specifier.startsWith("@stu/core")) {
      report(file, `route files should parse params through routing helpers, found ${specifier}`);
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
      if (
        specifier.startsWith("~/data") ||
        specifier.startsWith("~/domain-ui") ||
        specifier.startsWith("~/features") ||
        specifier.startsWith("~/app-shell") ||
        specifier.startsWith("expo-router") ||
        specifier.startsWith("@stu/core")
      ) {
        report(file, `generic components must stay app/domain agnostic, found ${specifier}`);
      }
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/domain-ui"))) {
  for (const specifier of importsOf(file)) {
    if (
      specifier.startsWith("~/app-shell") ||
      specifier.startsWith("~/data") ||
      specifier.startsWith("~/features") ||
      specifier.startsWith("expo-router")
    ) {
      report(file, `domain-ui must stay presentation-only, found ${specifier}`);
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src"))) {
  const relativeFile = relative(root, file);
  const canImportMockData =
    relativeFile.startsWith("apps/mobile/src/data/hooks/") ||
    relativeFile === "apps/mobile/src/data/app-data-provider.tsx" ||
    relativeFile.startsWith("apps/mobile/src/data/mock/");

  for (const specifier of importsOf(file)) {
    if (specifier.startsWith("~/data/mock") && !canImportMockData) {
      report(file, `mock data implementation is private to src/data, found ${specifier}`);
    }
    if (specifier.startsWith("~/mock-app")) {
      report(file, `old mock-app boundary was replaced by src/data, found ${specifier}`);
    }
    if (specifier.startsWith("~/utils")) {
      report(file, `use a named boundary such as platform/routing/data instead of ${specifier}`);
    }
    if (specifier.startsWith("~/navigation")) {
      report(file, `navigation helpers now live under app-shell or routing, found ${specifier}`);
    }
    if (specifier.startsWith("~/features/agenda") || specifier.startsWith("~/features/grades")) {
      report(file, `obsolete feature boundary import, found ${specifier}`);
    }
    if (specifier.startsWith("~/app-shell/routing")) {
      report(file, `routing helpers now live under src/routing, found ${specifier}`);
    }
    if (specifier.startsWith("~/components/layout/page-scaffold")) {
      report(file, `PageScaffold is route-aware and lives under app-shell, found ${specifier}`);
    }
    if (specifier.startsWith("~/components/layout/confirm-page-content")) {
      report(file, `confirmation content is domain-ui, found ${specifier}`);
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/data"))) {
  for (const specifier of importsOf(file)) {
    if (
      specifier.startsWith("~/features") ||
      specifier.startsWith("~/app-shell") ||
      specifier.startsWith("~/components") ||
      specifier.startsWith("~/domain-ui") ||
      specifier.startsWith("expo-router")
    ) {
      report(file, `data layer must not import UI/routing features, found ${specifier}`);
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/app-shell"))) {
  for (const specifier of importsOf(file)) {
    if (specifier.startsWith("~/features")) {
      report(file, `app-shell must not import product features, found ${specifier}`);
    }
    if (specifier.startsWith("~/data/mock")) {
      report(file, `app-shell must use the data facade, found ${specifier}`);
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/routing"))) {
  for (const specifier of importsOf(file)) {
    if (
      specifier.startsWith("~/app-shell") ||
      specifier.startsWith("~/components") ||
      specifier.startsWith("~/data") ||
      specifier.startsWith("~/domain-ui") ||
      specifier.startsWith("~/features")
    ) {
      report(file, `routing helpers must not import app layers, found ${specifier}`);
    }
  }
}

for (const file of sourceFiles(join(root, "apps/mobile/src/platform"))) {
  for (const specifier of importsOf(file)) {
    if (
      specifier.startsWith("~/app-shell") ||
      specifier.startsWith("~/components") ||
      specifier.startsWith("~/data") ||
      specifier.startsWith("~/domain-ui") ||
      specifier.startsWith("~/features")
    ) {
      report(file, `platform wrappers must not import app layers, found ${specifier}`);
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
      specifier.startsWith("~/data") ||
      specifier.startsWith("~/app-shell") ||
      specifier.startsWith("~/mock-app") ||
      specifier.startsWith("~/platform") ||
      specifier.startsWith("~/routing") ||
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
