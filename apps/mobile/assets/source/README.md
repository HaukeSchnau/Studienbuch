# Source Assets

`personal-notebook.svg` is the highest-quality source found for the Studienbuch notebook artwork.
It is copied unchanged from:

`/Volumes/BackupData/broken-macbook/Downloads/Personal notebook.svg`

That SVG contains the full original illustration. The app icon uses only the notebook region,
cropped away from the person illustration and placed on the Studienbuch green background.
The crop is tuned to match the earlier raster icon closely: render the SVG at 768 DPI, crop
`4360x3540+0+0`, resize the crop to 843px wide for 1024px outputs, and place it at `+155+181`.

`app-icon.png` is a 4096x4096 generated square raster from that SVG crop. The Expo-facing files in
`../images/` are generated derivatives:

- `icon.png`: 1024x1024 app icon
- `android-icon-foreground.png`: Android adaptive icon foreground
- `android-icon-background.png`: Android adaptive icon background
- `android-icon-monochrome.png`: Android themed icon mask
- `favicon.png`: web favicon
