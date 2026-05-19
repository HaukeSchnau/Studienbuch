# Source Assets

`app-icon.svg` is the source of truth for the Studienbuch app icon.
It is a notebook-only SVG crop built from the original illustration, with the Studienbuch green
background included in the SVG.

`personal-notebook.svg` is kept as the unchanged upstream artwork. It was copied from:

`/Volumes/BackupData/broken-macbook/Downloads/Personal notebook.svg`

`app-icon.png` is a 4096x4096 raster preview generated from `app-icon.svg`. The Expo-facing files
in `../images/` are generated from `app-icon.svg` by rendering large and downsampling:

- `icon.png`: 1024x1024 app icon
- `android-icon-foreground.png`: Android adaptive icon foreground
- `android-icon-background.png`: Android adaptive icon background
- `android-icon-monochrome.png`: Android themed icon mask
- `favicon.png`: web favicon
