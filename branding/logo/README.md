# Source Assets

`app-icon.svg` is the source of truth for the Studienbuch app icon.
It is a notebook-only SVG crop built from the original illustration, with the Studienbuch green
background included in the SVG.

`personal-notebook.svg` is kept as the unchanged upstream artwork. It was copied from:

`/Volumes/BackupData/broken-macbook/Downloads/Personal notebook.svg`

`app-icon.png` is a 4096x4096 production raster preview generated from `app-icon.svg`.
`app-icon-dev.png` is a generated development preview with a distinct amber background and `DEV`
badge.

The Expo-facing files in `apps/mobile/assets/images/` are generated from `app-icon.svg` by rendering
large and downsampling:

- `icon.png`: 1024x1024 app icon
- `icon-dev.png`: 1024x1024 development app icon
- `android-icon-foreground.png`: Android adaptive icon foreground
- `android-icon-dev-foreground.png`: Android adaptive icon foreground for development builds
- `android-icon-background.png`: Android adaptive icon background
- `android-icon-dev-background.png`: Android adaptive icon background for development builds
- `android-icon-monochrome.png`: Android themed icon mask
- `android-icon-dev-monochrome.png`: Android themed icon mask for development builds
- `favicon.png`: web favicon
- `favicon-dev.png`: web favicon for development builds

Regenerate everything with:

```sh
vp run --workspace-root generate:icons
```

From the mobile app workspace, the same generator is available as:

```sh
vp run --workspace-root generate:icons
```

You can also use `just icons` from the repository root.
