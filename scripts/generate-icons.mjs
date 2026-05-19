#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceSvg = resolve(repoRoot, "branding/logo/app-icon.svg");
const logoPreview = resolve(repoRoot, "branding/logo/app-icon.png");
const mobileImages = resolve(repoRoot, "apps/mobile/assets/images");
const tempDir = join(tmpdir(), "studienbuch-icon-generation");
const brandGreen = "#6DB868";

const outputs = {
  icon: resolve(mobileImages, "icon.png"),
  favicon: resolve(mobileImages, "favicon.png"),
  androidForeground: resolve(mobileImages, "android-icon-foreground.png"),
  androidBackground: resolve(mobileImages, "android-icon-background.png"),
  androidMonochrome: resolve(mobileImages, "android-icon-monochrome.png"),
};

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runMagick(args) {
  const magick = process.env.MAGICK ?? "magick";
  const result = spawnSync(magick, args, { stdio: "inherit" });

  if (result.error?.code === "ENOENT" && !process.env.MAGICK) {
    run("nix", ["run", "nixpkgs#imagemagick", "--", "magick", ...args]);
    return;
  }

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function generated(path) {
  return path.replace(`${repoRoot}/`, "");
}

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });
mkdirSync(dirname(logoPreview), { recursive: true });
mkdirSync(mobileImages, { recursive: true });

const transparent4096 = resolve(tempDir, "foreground-4096.png");

runMagick(["-density", "384", "-background", "none", sourceSvg, "-depth", "8", logoPreview]);
runMagick([logoPreview, "-resize", "1024x1024", "-depth", "8", outputs.icon]);
runMagick([logoPreview, "-resize", "48x48", "-depth", "8", outputs.favicon]);
runMagick([logoPreview, "-transparent", brandGreen, "-depth", "8", transparent4096]);
runMagick([transparent4096, "-resize", "1024x1024", "-depth", "8", outputs.androidForeground]);
runMagick(["-size", "1024x1024", `xc:${brandGreen}`, "-depth", "8", outputs.androidBackground]);
runMagick([
  outputs.androidForeground,
  "-alpha",
  "extract",
  "-threshold",
  "0",
  "-write",
  "mpr:alpha",
  "+delete",
  "-size",
  "1024x1024",
  "xc:white",
  "mpr:alpha",
  "-compose",
  "CopyOpacity",
  "-composite",
  "-depth",
  "8",
  outputs.androidMonochrome,
]);

console.log("Generated icons from branding/logo/app-icon.svg:");
for (const path of [logoPreview, ...Object.values(outputs)]) {
  console.log(`- ${generated(path)}`);
}
