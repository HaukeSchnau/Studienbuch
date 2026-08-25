#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as Schema from "effect/Schema";
import { parse as parseYaml } from "yaml";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const productionLockfile = join(repositoryRoot, "pnpm-lock.web.yaml");
const workspacePackages = [
  "apps/console",
  "apps/web",
  "packages/core",
  "packages/observability",
  "packages/server",
] as const;
const dependencyFields = ["dependencies", "devDependencies", "optionalDependencies"] as const;
const DependencySnapshot = Schema.Struct({ specifier: Schema.String, version: Schema.String });
const ImporterSnapshot = Schema.Struct({
  dependencies: Schema.optional(Schema.Record(Schema.String, DependencySnapshot)),
  devDependencies: Schema.optional(Schema.Record(Schema.String, DependencySnapshot)),
  optionalDependencies: Schema.optional(Schema.Record(Schema.String, DependencySnapshot)),
});
const ProductionLockSource = Schema.Struct({
  importers: Schema.Record(Schema.String, ImporterSnapshot),
  packages: Schema.Record(Schema.String, Schema.Unknown),
});
const PackageManifest = Schema.Record(Schema.String, Schema.Unknown);
const DependencyMap = Schema.Record(Schema.String, Schema.String);

function fail(message: string): never {
  console.error(`Web production lockfile: ${message}`);
  process.exit(2);
}

const mode = process.argv[2];
if (mode !== "--check" && mode !== "--write") {
  fail("expected --check or --write");
}

if (mode === "--check" && !existsSync(productionLockfile)) {
  fail("pnpm-lock.web.yaml is missing; run `just web-lock`");
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "studienbuch-web-lock-"));
process.on("exit", () => rmSync(temporaryRoot, { force: true, recursive: true }));

for (const relativePath of [
  "package.json",
  "pnpm-workspace.yaml",
  "nix/web-pnpmfile.cjs",
  "patches",
  ...workspacePackages.map((packagePath) => `${packagePath}/package.json`),
]) {
  const destination = join(temporaryRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(join(repositoryRoot, relativePath), destination, { recursive: true });
}
copyFileSync(join(temporaryRoot, "nix/web-pnpmfile.cjs"), join(temporaryRoot, ".pnpmfile.cjs"));

const workspaceManifestPath = join(temporaryRoot, "pnpm-workspace.yaml");
const workspaceManifest = readFileSync(workspaceManifestPath, "utf8");
const selectedPackageBlock = `packages:\n${workspacePackages
  .map((packagePath) => `  - ${packagePath}`)
  .join("\n")}\n`;
const productionWorkspaceManifest = workspaceManifest
  .replace(/^packages:\n(?: {2}-[^\n]+\n)+/m, selectedPackageBlock)
  .concat("\nautoInstallPeers: false\nresolvePeersFromWorkspaceRoot: false\n");
writeFileSync(workspaceManifestPath, productionWorkspaceManifest);

const exactVersion = (
  dependencyName: string,
  lockedVersion: string,
  declaredVersion: string,
): string => {
  const version = lockedVersion.match(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/)?.[0];
  if (version !== undefined) return version;

  const alias = lockedVersion.match(/^(@[^@/]+\/[^@]+)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/);
  if (alias?.[1] !== undefined && alias[2] !== undefined) {
    return alias[1] === dependencyName ? alias[2] : `npm:${alias[1]}@${alias[2]}`;
  }
  return declaredVersion;
};

const primaryLockPath = join(repositoryRoot, "pnpm-lock.yaml");
const primaryLock = Schema.decodeUnknownSync(ProductionLockSource)(
  parseYaml(readFileSync(primaryLockPath, "utf8")),
);
if (mode === "--write") {
  for (const packagePath of workspacePackages) {
    const importer = primaryLock.importers[packagePath];
    if (importer === undefined) fail(`pnpm-lock.yaml has no ${packagePath} importer`);

    const manifestPath = join(temporaryRoot, packagePath, "package.json");
    const manifest = Schema.decodeUnknownSync(PackageManifest)(
      JSON.parse(readFileSync(manifestPath, "utf8")),
    );
    for (const field of dependencyFields) {
      const dependencies = Schema.decodeUnknownSync(Schema.optional(DependencyMap))(
        manifest[field],
      );
      if (dependencies === undefined) continue;

      const lockedDependencies = importer[field] ?? {};
      Object.assign(manifest, {
        [field]: Object.fromEntries(
          Object.entries(dependencies).map(([name, specifier]) => {
            if (specifier.startsWith("workspace:")) return [name, specifier];
            const locked = lockedDependencies[name];
            if (locked === undefined) fail(`pnpm-lock.yaml has no ${packagePath} ${field}.${name}`);
            return [name, exactVersion(name, locked.version, specifier)];
          }),
        ),
      });
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

if (mode === "--check") {
  copyFileSync(productionLockfile, join(temporaryRoot, "pnpm-lock.yaml"));
} else {
  copyFileSync(primaryLockPath, join(temporaryRoot, "pnpm-lock.yaml"));
}

const install = spawnSync(
  "pnpm",
  [
    "install",
    "--lockfile-only",
    "--ignore-scripts",
    "--prod",
    ...(mode === "--check" ? ["--frozen-lockfile", "--offline"] : []),
  ],
  {
    cwd: temporaryRoot,
    env: { ...process.env, PNPM_CONFIG_TRUST_LOCKFILE: "true" },
    stdio: "inherit",
  },
);

if (install.error !== undefined) {
  fail(`could not start pnpm: ${install.error.message}`);
}
if (install.status !== 0) {
  fail(
    mode === "--check"
      ? "pnpm-lock.web.yaml does not match the production workspace; run `just web-lock`"
      : `pnpm exited with status ${install.status ?? "unknown"}`,
  );
}

const dependencyNameFromLine = (line: string): string | undefined => {
  const match = /^      (.+):$/.exec(line);
  if (match?.[1] === undefined) return undefined;
  const key = match[1];
  return key.startsWith("'") && key.endsWith("'") ? key.slice(1, -1) : key;
};
const findSpecifierLine = (
  lines: ReadonlyArray<string>,
  packagePath: string,
  field: (typeof dependencyFields)[number],
  dependencyName: string,
): number | undefined => {
  const importerStart = lines.indexOf(`  ${packagePath}:`);
  if (importerStart < 0) return undefined;
  const importerEnd = lines.findIndex(
    (line, index) => index > importerStart && /^  [^ ].*:$/.test(line),
  );
  const fieldStart = lines.indexOf(`    ${field}:`, importerStart);
  if (fieldStart < 0 || (importerEnd >= 0 && fieldStart >= importerEnd)) return undefined;
  const fieldEnd = lines.findIndex(
    (line, index) => index > fieldStart && (/^    [^ ].*:$/.test(line) || /^  [^ ].*:$/.test(line)),
  );
  const dependencyStart = lines.findIndex(
    (line, index) =>
      index > fieldStart &&
      (fieldEnd < 0 || index < fieldEnd) &&
      dependencyNameFromLine(line) === dependencyName,
  );
  if (dependencyStart < 0) return undefined;
  const dependencyEnd = lines.findIndex(
    (line, index) =>
      index > dependencyStart &&
      (/^      [^ ].*:$/.test(line) || /^    [^ ].*:$/.test(line) || /^  [^ ].*:$/.test(line)),
  );
  const specifierLine = lines.findIndex(
    (line, index) =>
      index > dependencyStart &&
      (dependencyEnd < 0 || index < dependencyEnd) &&
      line.startsWith("        specifier:"),
  );
  return specifierLine < 0 ? undefined : specifierLine;
};

const packageKeyFromLine = (line: string): string | undefined => {
  const match = /^  (.+):$/.exec(line);
  if (match?.[1] === undefined) return undefined;
  const key = match[1];
  return key.startsWith("'") && key.endsWith("'") ? key.slice(1, -1) : key;
};
const findPackageResolutionLine = (
  lines: ReadonlyArray<string>,
  packageKey: string,
): number | undefined => {
  const packageStart = lines.findIndex((line) => packageKeyFromLine(line) === packageKey);
  if (packageStart < 0) return undefined;
  const packageEnd = lines.findIndex(
    (line, index) => index > packageStart && packageKeyFromLine(line) !== undefined,
  );
  const resolutionLine = lines.findIndex(
    (line, index) =>
      index > packageStart &&
      (packageEnd < 0 || index < packageEnd) &&
      line.startsWith("    resolution:"),
  );
  return resolutionLine < 0 ? undefined : resolutionLine;
};

if (mode === "--write") {
  const primaryLines = readFileSync(primaryLockPath, "utf8").split("\n");
  const productionLines = readFileSync(join(temporaryRoot, "pnpm-lock.yaml"), "utf8").split("\n");
  for (const packagePath of workspacePackages) {
    const importer = primaryLock.importers[packagePath];
    if (importer === undefined) fail(`pnpm-lock.yaml has no ${packagePath} importer`);
    for (const field of dependencyFields) {
      for (const dependencyName of Object.keys(importer[field] ?? {})) {
        const primaryLine = findSpecifierLine(primaryLines, packagePath, field, dependencyName);
        const productionLine = findSpecifierLine(
          productionLines,
          packagePath,
          field,
          dependencyName,
        );
        if (primaryLine !== undefined && productionLine !== undefined) {
          const primarySpecifier = primaryLines[primaryLine];
          if (primarySpecifier === undefined) fail("could not read the primary specifier line");
          productionLines[productionLine] = primarySpecifier;
        }
      }
    }
  }

  // pnpm can omit integrity when it regenerates a direct-tarball package in the isolated
  // workspace. Preserve the primary lock's verified resolution instead of producing a Release
  // lock that the offline Nix install must reject.
  for (const packageKey of Object.keys(primaryLock.packages)) {
    const primaryLine = findPackageResolutionLine(primaryLines, packageKey);
    const productionLine = findPackageResolutionLine(productionLines, packageKey);
    if (primaryLine === undefined || productionLine === undefined) continue;
    const primaryResolution = primaryLines[primaryLine];
    const productionResolution = productionLines[productionLine];
    if (
      primaryResolution?.includes("integrity:") === true &&
      productionResolution?.includes("integrity:") === false
    ) {
      productionLines[productionLine] = primaryResolution;
    }
  }
  writeFileSync(join(temporaryRoot, "pnpm-lock.yaml"), productionLines.join("\n"));
}

const generatedLockfile = join(temporaryRoot, "pnpm-lock.yaml");
const generatedLock = readFileSync(generatedLockfile, "utf8");
const generatedPackages = Schema.decodeUnknownSync(ProductionLockSource)(
  parseYaml(generatedLock),
).packages;
const unpinnedPackages = Object.keys(generatedPackages).filter(
  (packageKey) => !Object.hasOwn(primaryLock.packages, packageKey),
);
if (unpinnedPackages.length > 0) {
  fail(
    `the production graph resolved packages outside pnpm-lock.yaml:\n${unpinnedPackages.join("\n")}`,
  );
}
for (const forbiddenPackageKey of [
  "  '@expo/",
  "  'expo@",
  "  'expo-",
  "  '@react-native/",
  "  'react-native@",
]) {
  if (generatedLock.includes(forbiddenPackageKey)) {
    fail(`the isolated web graph contains ${forbiddenPackageKey.trim()}`);
  }
}

if (mode === "--write") {
  copyFileSync(generatedLockfile, productionLockfile);
  chmodSync(productionLockfile, 0o644);
  console.log("Updated pnpm-lock.web.yaml from the isolated production workspace.");
} else {
  console.log("pnpm-lock.web.yaml matches the isolated production workspace.");
}
