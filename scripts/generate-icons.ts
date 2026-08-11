#!/usr/bin/env node
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Script from "./lib/script.ts";

const brandGreen = "#6DB868";
const brandAccentGreen = "#6DB968";
const devBackground = "#F8C04E";
const devRecolorFuzz = "10%";
const androidAdaptiveForegroundSize = 720;

const generateIcons = Effect.fn("generateIcons")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* path.fromFileUrl(new URL("..", import.meta.url));
  const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "studienbuch-icons-" });

  const sourceSvg = path.join(repoRoot, "branding/logo/app-icon.svg");
  const logoPreview = path.join(repoRoot, "branding/logo/app-icon.png");
  const devLogoPreview = path.join(repoRoot, "branding/logo/app-icon-dev.png");
  const mobileImages = path.join(repoRoot, "apps/mobile/assets/images");
  const webPublic = path.join(repoRoot, "apps/web/public");

  const mobileImage = (name: string) => path.join(mobileImages, name);
  const webAsset = (name: string) => path.join(webPublic, name);
  const temporary = (name: string) => path.join(tempDir, name);

  const outputs = {
    icon: mobileImage("icon.png"),
    devIcon: mobileImage("icon-dev.png"),
    favicon: mobileImage("favicon.png"),
    devFavicon: mobileImage("favicon-dev.png"),
    androidForeground: mobileImage("android-icon-foreground.png"),
    androidDevForeground: mobileImage("android-icon-dev-foreground.png"),
    androidBackground: mobileImage("android-icon-background.png"),
    androidDevBackground: mobileImage("android-icon-dev-background.png"),
    androidMonochrome: mobileImage("android-icon-monochrome.png"),
    androidDevMonochrome: mobileImage("android-icon-dev-monochrome.png"),
    webFavicon: webAsset("favicon.ico"),
    webLogo192: webAsset("logo192.png"),
    webLogo512: webAsset("logo512.png"),
    webManifest: webAsset("manifest.json"),
  };

  yield* Effect.forEach(
    [path.dirname(logoPreview), mobileImages, webPublic],
    (directory) => fs.makeDirectory(directory, { recursive: true }),
    { concurrency: "unbounded", discard: true },
  );

  const configuredMagick = yield* Config.option(Config.nonEmptyString("MAGICK"));
  const magick = Option.match(configuredMagick, {
    onNone: () =>
      Script.command("magick", {
        fallback: {
          executable: "nix",
          args: ["run", "nixpkgs#imagemagick", "--", "magick"],
        },
      }),
    onSome: Script.command,
  });

  const resize = (input: string, size: number, output: string) =>
    magick`${input} -resize ${`${size}x${size}`} -depth 8 ${output}`;

  const roundedResize = Effect.fn("generateIcons.roundedResize")(function* (
    input: string,
    size: number,
    output: string,
  ) {
    const mask = temporary(`rounded-mask-${size}.png`);
    const radius = Math.round(size * 0.22);

    yield* magick`
      -size ${`${size}x${size}`}
      xc:black
      -fill white
      -draw ${`roundrectangle 0,0 ${size - 1},${size - 1} ${radius},${radius}`}
      -depth 8
      ${mask}
    `;
    yield* magick`
      ${input}
      -resize ${`${size}x${size}`}
      ${mask}
      -alpha off
      -compose CopyOpacity
      -composite
      -depth 8
      ${output}
    `;
  });

  const transparent4096 = temporary("foreground-4096.png");
  const devBase4096 = temporary("dev-base-4096.png");
  const devTransparent4096 = temporary("dev-foreground-4096.png");
  const devBadge = temporary("dev-badge.svg");
  const devBadgePng = temporary("dev-badge.png");
  const androidForegroundPadded = temporary("android-foreground-padded.png");
  const androidDevForegroundPadded = temporary("android-dev-foreground-padded.png");
  const webFavicon16 = temporary("favicon-16.png");
  const webFavicon24 = temporary("favicon-24.png");
  const webFavicon32 = temporary("favicon-32.png");
  const webFavicon64 = temporary("favicon-64.png");

  yield* fs.writeFileString(
    devBadge,
    `<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096" viewBox="0 0 4096 4096">
  <g transform="translate(2230 280) rotate(8 760 300)">
    <rect width="1520" height="600" rx="160" fill="#171717"/>
    <text x="760" y="408" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="360" font-weight="900" letter-spacing="18" text-anchor="middle">DEV</text>
  </g>
</svg>
`,
  );

  yield* magick`-density 384 -background none ${sourceSvg} -depth 8 ${logoPreview}`;
  yield* magick`
    ${logoPreview}
    -fuzz ${devRecolorFuzz}
    -fill ${devBackground}
    -opaque ${brandGreen}
    -opaque ${brandAccentGreen}
    +fuzz
    -depth 8
    ${devBase4096}
  `;
  yield* magick`-background none ${devBadge} -depth 8 ${devBadgePng}`;
  yield* magick`${devBase4096} ${devBadgePng} -compose over -composite -depth 8 ${devLogoPreview}`;

  yield* resize(logoPreview, 1024, outputs.icon);
  yield* resize(devLogoPreview, 1024, outputs.devIcon);
  yield* resize(logoPreview, 48, outputs.favicon);
  yield* resize(devLogoPreview, 48, outputs.devFavicon);
  yield* roundedResize(logoPreview, 192, outputs.webLogo192);
  yield* roundedResize(logoPreview, 512, outputs.webLogo512);
  yield* roundedResize(logoPreview, 16, webFavicon16);
  yield* roundedResize(logoPreview, 24, webFavicon24);
  yield* roundedResize(logoPreview, 32, webFavicon32);
  yield* roundedResize(logoPreview, 64, webFavicon64);
  yield* magick`${[webFavicon16, webFavicon24, webFavicon32, webFavicon64]} ${outputs.webFavicon}`;

  yield* magick`${logoPreview} -transparent ${brandGreen} -depth 8 ${transparent4096}`;
  yield* magick`
    ${logoPreview}
    -fuzz ${devRecolorFuzz}
    -transparent ${brandGreen}
    -fill ${devBackground}
    -opaque ${brandAccentGreen}
    +fuzz
    -depth 8
    ${devTransparent4096}
  `;

  const adaptiveForegroundSize = `${androidAdaptiveForegroundSize}x${androidAdaptiveForegroundSize}`;
  yield* magick`
    ${transparent4096}
    -resize ${adaptiveForegroundSize}
    -gravity center
    -background none
    -extent 1024x1024
    -depth 8
    ${androidForegroundPadded}
  `;
  yield* magick`
    ${devTransparent4096}
    -resize ${adaptiveForegroundSize}
    -gravity center
    -background none
    -extent 1024x1024
    -depth 8
    ${androidDevForegroundPadded}
  `;

  yield* magick`${androidForegroundPadded} -depth 8 ${outputs.androidForeground}`;
  yield* magick`${androidDevForegroundPadded} -depth 8 ${outputs.androidDevForeground}`;
  yield* magick`-size 1024x1024 ${`xc:${brandGreen}`} -depth 8 ${outputs.androidBackground}`;
  yield* magick`-size 1024x1024 ${`xc:${devBackground}`} -depth 8 ${outputs.androidDevBackground}`;

  const monochrome = (input: string, output: string) =>
    magick`
      ${input}
      -alpha extract
      -threshold 0
      -write mpr:alpha
      +delete
      -size 1024x1024
      xc:white
      mpr:alpha
      -compose CopyOpacity
      -composite
      -depth 8
      ${output}
    `;

  yield* monochrome(outputs.androidForeground, outputs.androidMonochrome);
  yield* monochrome(outputs.androidDevForeground, outputs.androidDevMonochrome);

  yield* fs.writeFileString(
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

  yield* Console.log("Generated icons from branding/logo/app-icon.svg:");
  yield* Effect.forEach(
    [logoPreview, devLogoPreview, ...Object.values(outputs)],
    (generatedPath) => Console.log(`- ${path.relative(repoRoot, generatedPath)}`),
    { discard: true },
  );
});

Script.runMain(generateIcons().pipe(Effect.scoped));
