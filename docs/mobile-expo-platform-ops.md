# Mobile Expo Platform Ops

This note records the SDK 56 platform work that is now part of `apps/mobile`.

## Native UI Boundaries

- Expo UI imports live behind `apps/mobile/src/components/native/expo-ui.ts`.
- Jetpack Compose button primitives live behind `apps/mobile/src/components/native/expo-ui-compose.ts`.
- SwiftUI widget primitives live behind `apps/mobile/src/platform/widgets/expo-swift-ui.ts`.
- Expo Router native tabs are isolated in `apps/mobile/src/app-shell/navigation/native-tabs.tsx`.

Keep feature code importing these app-owned modules instead of reaching into unstable or community Expo paths directly.

## OTA Updates

EAS Update is configured in `apps/mobile/app.config.ts` with:

- `runtimeVersion.policy = "appVersion"`
- `updates.url = https://u.expo.dev/76a4b2c7-e6dc-40fa-808e-27c1b574d342`
- Hermes bytecode diff support enabled through `enableBsdiffPatchSupport`
- bundled asset patterns for app icons, local task images, and Expo Router navigation assets required by native stacks

Channels are defined in `apps/mobile/eas.json`:

- `development`
- `preview`
- `production`

Useful commands:

- `just mobile-update-fingerprints`
- `just mobile-update-assets`
- `just mobile-update-preview`
- `just mobile-update-production`
- `just mobile-update-rollback`

The EAS workflow files in `apps/mobile/.eas/workflows` publish preview updates on pull requests and gate production OTA updates by native fingerprint. If no compatible production build exists, the production workflow creates fresh native builds instead of publishing an incompatible OTA.

`just mobile-update-assets` generates temporary iOS and Android embedded manifests under `apps/mobile/.expo-update-verify`, exports each native bundle with an asset map, and runs `expo-updates assets:verify` against both. Pass `ios` or `android` as the recipe argument to check only one target.

## Observe

`apps/mobile/src/app/_layout.tsx` is wrapped with `ObserveRoot`. It marks the app interactive after fonts are ready and the splash screen has been hidden. Query production metrics with:

- `just mobile-observe-versions`
- `just mobile-observe-metrics`

## Widgets And Live Activities

`expo-widgets` is registered in `apps/mobile/app.config.ts` for:

- `StudienbuchSummaryWidget`
- `StudienbuchStudySessionActivity`

The widget module lives at `apps/mobile/src/platform/widgets/studienbuch-widget.tsx`.

The app publishes a real data-derived widget snapshot from `apps/mobile/src/app-shell/widgets/studienbuch-widget-publisher.tsx`. Today it includes open task count, the next due task, and a short status line. This should later be backed by the durable local-first store once the app has one instead of only the current mock runtime provider.

The Live Activity helper is intentionally not auto-started. Use `startStudienbuchStudySessionActivity` from a concrete session or lesson workflow when there is a user action that clearly starts time-sensitive work.
