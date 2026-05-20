#!/usr/bin/env bun
import { $ } from "bun";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const sourceSvg = resolve(repoRoot, "branding/logo/app-icon.svg");
const logoPreview = resolve(repoRoot, "branding/logo/app-icon.png");
const devLogoPreview = resolve(repoRoot, "branding/logo/app-icon-dev.png");
const mobileImages = resolve(repoRoot, "apps/mobile/assets/images");
const webPublic = resolve(repoRoot, "apps/web/public");
const tempDir = join(tmpdir(), "studienbuch-icon-generation");
const brandGreen = "#6DB868";
const brandAccentGreen = "#6DB968";
const devBackground = "#F8C04E";
const devRecolorFuzz = "10%";

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
} satisfies Record<string, string>;

async function runMagick(args: string[]) {
  const magick = Bun.env.MAGICK ?? Bun.which("magick");

  if (magick) {
    await $`${magick} ${args}`;
    return;
  }

  await $`nix run nixpkgs#imagemagick -- magick ${args}`;
}

function generated(path: string) {
  return path.replace(`${repoRoot}/`, "");
}

await $`rm -rf ${tempDir}`;
await $`mkdir -p ${[tempDir, dirname(logoPreview), mobileImages, webPublic]}`;

const transparent4096 = resolve(tempDir, "foreground-4096.png");
const devBase4096 = resolve(tempDir, "dev-base-4096.png");
const devTransparent4096 = resolve(tempDir, "dev-foreground-4096.png");
const devBadge = resolve(tempDir, "dev-badge.svg");
const devBadgePng = resolve(tempDir, "dev-badge.png");
const webFavicon16 = resolve(tempDir, "favicon-16.png");
const webFavicon24 = resolve(tempDir, "favicon-24.png");
const webFavicon32 = resolve(tempDir, "favicon-32.png");
const webFavicon64 = resolve(tempDir, "favicon-64.png");

async function roundedResize(input: string, size: number, output: string) {
  const mask = resolve(tempDir, `rounded-mask-${size}.png`);
  const radius = Math.round(size * 0.22);

  await runMagick([
    "-size",
    `${size}x${size}`,
    "xc:black",
    "-fill",
    "white",
    "-draw",
    `roundrectangle 0,0 ${size - 1},${size - 1} ${radius},${radius}`,
    "-depth",
    "8",
    mask,
  ]);
  await runMagick([
    input,
    "-resize",
    `${size}x${size}`,
    mask,
    "-alpha",
    "off",
    "-compose",
    "CopyOpacity",
    "-composite",
    "-depth",
    "8",
    output,
  ]);
}

await Bun.write(
  devBadge,
  `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096" viewBox="0 0 4096 4096">
  <g transform="translate(2230 280) rotate(8 760 300)">
    <rect width="1520" height="600" rx="160" fill="#171717"/>
    <text x="760" y="408" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="360" font-weight="900" letter-spacing="18" text-anchor="middle">DEV</text>
  </g>
</svg>
`,
);

await runMagick(["-density", "384", "-background", "none", sourceSvg, "-depth", "8", logoPreview]);
await runMagick([
  logoPreview,
  "-fuzz",
  devRecolorFuzz,
  "-fill",
  devBackground,
  "-opaque",
  brandGreen,
  "-opaque",
  brandAccentGreen,
  "+fuzz",
  "-depth",
  "8",
  devBase4096,
]);
await runMagick(["-background", "none", devBadge, "-depth", "8", devBadgePng]);
await runMagick([
  devBase4096,
  devBadgePng,
  "-compose",
  "over",
  "-composite",
  "-depth",
  "8",
  devLogoPreview,
]);
await runMagick([logoPreview, "-resize", "1024x1024", "-depth", "8", outputs.icon]);
await runMagick([devLogoPreview, "-resize", "1024x1024", "-depth", "8", outputs.devIcon]);
await runMagick([logoPreview, "-resize", "48x48", "-depth", "8", outputs.favicon]);
await runMagick([devLogoPreview, "-resize", "48x48", "-depth", "8", outputs.devFavicon]);
await roundedResize(logoPreview, 192, outputs.webLogo192);
await roundedResize(logoPreview, 512, outputs.webLogo512);
await roundedResize(logoPreview, 16, webFavicon16);
await roundedResize(logoPreview, 24, webFavicon24);
await roundedResize(logoPreview, 32, webFavicon32);
await roundedResize(logoPreview, 64, webFavicon64);
await runMagick([webFavicon16, webFavicon24, webFavicon32, webFavicon64, outputs.webFavicon]);
await runMagick([logoPreview, "-transparent", brandGreen, "-depth", "8", transparent4096]);
await runMagick([
  logoPreview,
  "-fuzz",
  devRecolorFuzz,
  "-transparent",
  brandGreen,
  "-fill",
  devBackground,
  "-opaque",
  brandAccentGreen,
  "+fuzz",
  "-depth",
  "8",
  devTransparent4096,
]);
await runMagick([
  transparent4096,
  "-resize",
  "1024x1024",
  "-depth",
  "8",
  outputs.androidForeground,
]);
await runMagick([
  devTransparent4096,
  "-resize",
  "1024x1024",
  "-depth",
  "8",
  outputs.androidDevForeground,
]);
await runMagick([
  "-size",
  "1024x1024",
  `xc:${brandGreen}`,
  "-depth",
  "8",
  outputs.androidBackground,
]);
await runMagick([
  "-size",
  "1024x1024",
  `xc:${devBackground}`,
  "-depth",
  "8",
  outputs.androidDevBackground,
]);
await runMagick([
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
await runMagick([
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

await Bun.write(
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
