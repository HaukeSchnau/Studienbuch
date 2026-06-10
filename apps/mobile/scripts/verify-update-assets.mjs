import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(projectRoot, "../..");
const workDir = resolve(projectRoot, ".expo-update-verify");
const requestedPlatform = process.env.PLATFORM;
const platforms = requestedPlatform ? [requestedPlatform] : ["ios", "android"];

const validPlatforms = new Set(["ios", "android"]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1",
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const platform of platforms) {
  if (!validPlatforms.has(platform)) {
    console.error(`Unsupported PLATFORM=${platform}. Expected ios or android.`);
    process.exit(1);
  }
}

rmSync(workDir, { recursive: true, force: true });

for (const platform of platforms) {
  const buildDir = join(workDir, `${platform}-build`);
  const exportDir = join(workDir, `${platform}-export`);
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(exportDir, { recursive: true });

  run(process.execPath, [
    resolve(repoRoot, "node_modules/expo-updates/utils/build/createUpdatesResources.js"),
    platform,
    projectRoot,
    buildDir,
    "all",
  ]);

  run("bunx", [
    "expo",
    "export",
    "--platform",
    platform,
    "--dump-assetmap",
    "--output-dir",
    exportDir,
  ]);

  run("bunx", [
    "expo-updates",
    "assets:verify",
    projectRoot,
    "--platform",
    platform,
    "--asset-map-path",
    join(exportDir, "assetmap.json"),
    "--exported-manifest-path",
    join(exportDir, "metadata.json"),
    "--build-manifest-path",
    join(buildDir, "app.manifest"),
  ]);
}

console.log("Expo Updates asset verification passed.");
