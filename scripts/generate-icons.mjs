#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceSvg = resolve(repoRoot, "branding/logo/app-icon.svg");
const logoPreview = resolve(repoRoot, "branding/logo/app-icon.png");
const devLogoPreview = resolve(repoRoot, "branding/logo/app-icon-dev.png");
const mobileImages = resolve(repoRoot, "apps/mobile/assets/images");
const webPublic = resolve(repoRoot, "apps/web/public");
const tempDir = join(tmpdir(), "studienbuch-icon-generation");
const brandGreen = "#6DB868";
const devBackground = "#F8C04E";

const outputs = {
  icon: resolve(mobileImages, "icon.png"),
  devIcon: resolve(mobileImages, "icon-dev.png"),
  favicon: resolve(mobileImages, "favicon.png"),
  devFavicon: resolve(mobileImages, "favicon-dev.png"),
  androidForeground: resolve(mobileImages, "android-icon-foreground.png"),
  androidDevForeground: resolve(mobileImages, "android-icon-dev-foreground.png"),
  androidBackground: resolve(mobileImages, "android-icon-background.png"),
  androidDevBackground: resolve(mobileImages, "android-icon-dev-background.png"),
  androidMonochrome: resolve(mobileImages, "android-icon-monochrome.png"),
  androidDevMonochrome: resolve(mobileImages, "android-icon-dev-monochrome.png"),
  webFavicon: resolve(webPublic, "favicon.ico"),
  webLogo192: resolve(webPublic, "logo192.png"),
  webLogo512: resolve(webPublic, "logo512.png"),
  webManifest: resolve(webPublic, "manifest.json"),
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
mkdirSync(webPublic, { recursive: true });

const transparent4096 = resolve(tempDir, "foreground-4096.png");
const devBase4096 = resolve(tempDir, "dev-base-4096.png");
const devTransparent4096 = resolve(tempDir, "dev-foreground-4096.png");
const devBadge = resolve(tempDir, "dev-badge.svg");
const devBadgePng = resolve(tempDir, "dev-badge.png");
const webFavicon16 = resolve(tempDir, "favicon-16.png");
const webFavicon24 = resolve(tempDir, "favicon-24.png");
const webFavicon32 = resolve(tempDir, "favicon-32.png");
const webFavicon64 = resolve(tempDir, "favicon-64.png");

writeFileSync(
  devBadge,
  `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096" viewBox="0 0 4096 4096">
  <g transform="translate(2230 280) rotate(8 760 300)">
    <rect width="1520" height="600" rx="160" fill="#171717"/>
    <text x="760" y="408" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="360" font-weight="900" letter-spacing="18" text-anchor="middle">DEV</text>
  </g>
</svg>
`,
);

runMagick(["-density", "384", "-background", "none", sourceSvg, "-depth", "8", logoPreview]);
runMagick([logoPreview, "-fill", devBackground, "-opaque", brandGreen, "-depth", "8", devBase4096]);
runMagick(["-background", "none", devBadge, "-depth", "8", devBadgePng]);
runMagick([
  devBase4096,
  devBadgePng,
  "-compose",
  "over",
  "-composite",
  "-depth",
  "8",
  devLogoPreview,
]);
runMagick([logoPreview, "-resize", "1024x1024", "-depth", "8", outputs.icon]);
runMagick([devLogoPreview, "-resize", "1024x1024", "-depth", "8", outputs.devIcon]);
runMagick([logoPreview, "-resize", "48x48", "-depth", "8", outputs.favicon]);
runMagick([devLogoPreview, "-resize", "48x48", "-depth", "8", outputs.devFavicon]);
runMagick([logoPreview, "-resize", "192x192", "-depth", "8", outputs.webLogo192]);
runMagick([logoPreview, "-resize", "512x512", "-depth", "8", outputs.webLogo512]);
runMagick([logoPreview, "-resize", "16x16", "-depth", "8", webFavicon16]);
runMagick([logoPreview, "-resize", "24x24", "-depth", "8", webFavicon24]);
runMagick([logoPreview, "-resize", "32x32", "-depth", "8", webFavicon32]);
runMagick([logoPreview, "-resize", "64x64", "-depth", "8", webFavicon64]);
runMagick([webFavicon16, webFavicon24, webFavicon32, webFavicon64, outputs.webFavicon]);
runMagick([logoPreview, "-transparent", brandGreen, "-depth", "8", transparent4096]);
runMagick([devLogoPreview, "-transparent", devBackground, "-depth", "8", devTransparent4096]);
runMagick([transparent4096, "-resize", "1024x1024", "-depth", "8", outputs.androidForeground]);
runMagick([
  devTransparent4096,
  "-resize",
  "1024x1024",
  "-depth",
  "8",
  outputs.androidDevForeground,
]);
runMagick(["-size", "1024x1024", `xc:${brandGreen}`, "-depth", "8", outputs.androidBackground]);
runMagick([
  "-size",
  "1024x1024",
  `xc:${devBackground}`,
  "-depth",
  "8",
  outputs.androidDevBackground,
]);
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
runMagick([
  outputs.androidDevForeground,
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
  outputs.androidDevMonochrome,
]);

writeFileSync(
  outputs.webManifest,
  `${JSON.stringify(
    {
      short_name: "Studienbuch",
      name: "Studienbuch",
      icons: [
        {
          src: "favicon.ico",
          sizes: "64x64 32x32 24x24 16x16",
          type: "image/x-icon",
        },
        {
          src: "logo192.png",
          type: "image/png",
          sizes: "192x192",
        },
        {
          src: "logo512.png",
          type: "image/png",
          sizes: "512x512",
        },
      ],
      start_url: ".",
      display: "standalone",
      theme_color: brandGreen,
      background_color: brandGreen,
    },
    null,
    2,
  )}\n`,
);

console.log("Generated icons from branding/logo/app-icon.svg:");
for (const path of [logoPreview, devLogoPreview, ...Object.values(outputs)]) {
  console.log(`- ${generated(path)}`);
}
