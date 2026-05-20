# Mobile Native Platform Strategy

Last researched: 2026-05-20

## Scope

This note answers: "How should the Expo mobile app look and feel as native and true to the platform as possible?"

Assumptions:

- The mobile app remains Expo-based and local-first.
- iOS and Android should feel native to their own platforms, not like a single branded web UI stretched across both.
- Web can share domain logic and some layout ideas, but mobile should optimize for platform conventions first.
- The current package set is intentional: `apps/mobile` already uses Expo SDK 56 preview packages, React Native 0.85.3, `@expo/ui`, `expo-glass-effect`, `expo-symbols`, Expo Router, NativeWind, and `react-native-css`.

## Executive Summary

The current Expo and React Native landscape has moved in a direction that strongly supports a native-first Studienbuch app without abandoning React or Expo. The best path is not "make React Native views look native by hand." The best path is:

1. Use Expo Router for app structure and platform-native navigation where possible.
2. Use Expo UI for system controls and form-heavy surfaces because it renders through SwiftUI on iOS and Jetpack Compose on Android.
3. Keep React Native views for custom content layouts, domain-specific visualizations, and glue code.
4. Use platform-specific components when iOS and Android conventions diverge.
5. Treat NativeWind/react-native-css as layout and utility tools, not as the source of truth for controls, navigation chrome, or platform materials.

In practical terms, Studienbuch should have a thin shared product architecture and a deliberately platform-shaped presentation layer.

After reviewing the Expo SDK 56 beta changelog, this recommendation is stronger than before: Expo now describes Expo UI's SwiftUI and Jetpack Compose APIs as stable and ready for production, with universal components available for cross-platform surfaces and community-component replacements for common controls.

## Current Landscape

### Expo SDK 56 And React Native 0.85

React Native 0.85 is the current stable React Native release as of the researched date, and the React Native team states that Expo SDK 56 includes React Native 0.85. The SDK 56 beta changelog specifically says the beta shipped with React Native 0.85.2 and React 19.2.3; this repo has already moved to React Native 0.85.3 while staying within that same SDK 56 generation. The release adds Hermes V1 by default, the shared animation backend, React Native DevTools improvements, Metro TLS support, and several breaking changes such as the removal of `StyleSheet.absoluteFillObject`.

Expo SDK 55 and later run entirely on React Native's New Architecture. Expo explicitly says the New Architecture is always enabled and cannot be disabled in SDK 55+. This matters for native-feeling UI because the project should not plan around old-architecture compatibility escape hatches. Any third-party native library should be checked for New Architecture compatibility before adoption.

Implication for Studienbuch: the app is already on the modern path. Prefer maintained libraries that support Expo SDK 56 and RN 0.85, and be skeptical of older native UI packages that still assume the legacy architecture. Hermes V1 and Expo Modules performance work make native-module-backed UI and local-first data paths more attractive, but they also raise the importance of testing startup, first render, and input latency on real devices.

Sources:

- [React Native 0.85 release notes](https://reactnative.dev/blog/2026/04/07/react-native-0.85)
- [Expo New Architecture guide](https://docs.expo.dev/guides/new-architecture/)
- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)

### Expo UI Is The Key Native-Feel Primitive

`@expo/ui` is no longer just another React Native component kit. In SDK 56, Expo documents three relevant layers:

- Universal components from `@expo/ui`, which use one API and delegate to platform-native UI toolkits on Android and iOS.
- `@expo/ui/swift-ui`, which renders SwiftUI views from React Native.
- `@expo/ui/jetpack-compose`, which renders Jetpack Compose views from React Native.

Expo's universal docs say the platform-native look and feel is preserved because the universal components delegate to Jetpack Compose and SwiftUI. The platform-specific docs confirm that SwiftUI components must be wrapped in `Host`, and Jetpack Compose components must also be wrapped in their own `Host`.

The SDK 56 beta changelog goes further: Expo says Expo UI is ready for production, the SwiftUI and Jetpack Compose APIs are stable, and the new universal components cover layout primitives, text, inputs, controls, and sheets. Expo also introduced drop-in replacement packages for common community UI libraries, including segmented controls, pickers, date/time pickers, masked views, and bottom sheets.

The important architectural idea is the `Host` boundary: native subtrees should be deliberate islands inside the React Native app. They are ideal for controls, forms, settings screens, sheets, pickers, lists, toggles, sliders, date pickers, and other UI where users already expect system behavior.

Implication for Studienbuch: use Expo UI as the default for controls and settings-like screens. Use universal Expo UI first when the same structure makes sense on both platforms; use `swift-ui` or `jetpack-compose` directly when the platform conventions diverge. Avoid adding community controls that Expo UI now replaces unless there is a clear missing capability.

Sources:

- [Expo UI Universal components](https://docs.expo.dev/versions/v56.0.0/sdk/ui/universal/)
- [Expo UI SwiftUI components](https://docs.expo.dev/versions/v56.0.0/sdk/ui/swift-ui/)
- [Expo UI Jetpack Compose components](https://docs.expo.dev/versions/v56.0.0/sdk/ui/jetpack-compose/)
- [Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)

### Navigation Should Use Native Chrome Where It Matters

Expo Router now documents native tabs through `expo-router/unstable-native-tabs`. The API is alpha, but it exists specifically to use the native system tab bar instead of a JavaScript tab bar. It also supports platform-native behaviors such as tapping the active tab to scroll to top, which is available on Android in SDK 55+ and is a familiar convention on iOS.

The SDK 56 beta changelog also matters for stack navigation: `expo-router` no longer depends on React Navigation, Android has experimental support for the same `Stack.Toolbar` API available on iOS, and there is experimental support for a new native stack version with initial Material-style headers and predictive back gesture support.

Implication for Studienbuch: if the app uses a tabbed structure, prototype with native tabs early. Do not over-style the tab bar. Use native item labels, system icon mappings, and platform behavior. Because native tabs, Android toolbar support, and Stack v5 are still experimental/alpha areas, isolate navigation layout decisions so they can be swapped if Expo changes the API. Also avoid importing directly from `@react-navigation/*` in the Expo Router app unless there is a deliberate migration plan.

Sources:

- [Expo Router native tabs guide](https://docs.expo.dev/router/advanced/native-tabs/)
- [Expo Router native tabs SDK reference](https://docs.expo.dev/versions/v56.0.0/sdk/router-native-tabs/)
- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)

### iOS: SwiftUI, System Materials, Liquid Glass

Apple's current design direction emphasizes system-provided controls, hierarchy, harmony with device shapes, and consistency across window sizes and displays. The updated iOS material guidance introduces Liquid Glass as a functional layer for controls and navigation, not as decoration inside normal content.

Expo exposes this through `expo-glass-effect`. `GlassView` renders native iOS liquid glass using `UIVisualEffectView`, but it is only available on iOS 26 and above and falls back to a regular `View` elsewhere. Expo also documents runtime checks like `isGlassEffectAPIAvailable()` and notes that accessibility settings can reduce transparency, so `AccessibilityInfo.isReduceTransparencyEnabled()` must be considered.

Implication for Studienbuch: on iOS, prefer SwiftUI/system components and let them adopt current iOS styling automatically. Use `expo-glass-effect` sparingly for navigation or floating functional controls only. Do not use Liquid Glass as a general card/background treatment.

Sources:

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
- [Expo GlassEffect](https://docs.expo.dev/versions/v56.0.0/sdk/glass-effect/)

### Android: Jetpack Compose And Material 3

Android's native UI direction is Jetpack Compose with Material 3. Android's official Compose Material 3 release docs describe Material 3 as the next evolution of Material Design, with updated theming, components, and Material You dynamic color designed to fit Android 12+ system UI.

Expo UI's Jetpack Compose layer maps directly into this world. It exposes Android-native components such as `FloatingActionButton`, `LazyColumn`, `ModalBottomSheet`, `SearchBar`, `SegmentedButton`, `Snackbar`, `Switch`, and `TextField`.

Implication for Studienbuch: Android should not mimic iOS lists, glass, or navigation. Use Material 3 structure: top app bars where useful, floating action buttons for primary creation actions, Android-appropriate bottom sheets, ripple/touch feedback, and Material Symbols.

Sources:

- [Android Compose Material 3 release docs](https://developer.android.com/jetpack/androidx/releases/compose-material3)
- [Expo UI Jetpack Compose components](https://docs.expo.dev/versions/v56.0.0/sdk/ui/jetpack-compose/)

### Icons Should Be Platform-Mapped

`expo-symbols` is available in SDK 56 and provides native symbol access across platforms: SF Symbols on iOS/tvOS and Material Symbols on Android/web. It is currently marked beta and subject to breaking changes, so icon usage should be centralized instead of scattered across the app.

Implication for Studienbuch: create a small app-level icon mapping module, for example `school`, `calendar`, `tasks`, `settings`, `add`, with explicit `{ ios, android, web }` symbol names. That keeps platform fidelity without hard-coding platform checks everywhere.

Source:

- [Expo Symbols](https://docs.expo.dev/versions/v56.0.0/sdk/symbols/)

### Expo Development Workflow Supports Native-First Apps

Expo's Continuous Native Generation model means native projects can be generated from app config, config plugins, and package dependencies rather than manually maintained forever. Expo's custom native code docs also make clear that development builds are the path for using native libraries beyond Expo Go.

The SDK 56 beta changelog adds several operational details:

- Precompiled Expo packages are enabled by default on iOS, speeding up local and EAS builds for complex Expo modules.
- Inline Expo modules can live directly in the app project and autolink during prebuild, making small native extensions easier to prototype.
- Type-safe config plugins are exported by Expo packages that ship plugins, which fits this repo's TypeScript `app.config.ts`.
- Expo CLI has faster bundler warmup, a `watchFolders`-free Metro experiment enabled by default, native Node.js file watching, TypeScript 6 support, automatic `import.meta` support, and Hermes V1-related bundling improvements.

Implication for Studienbuch: native-first UI does not require ejecting. It does mean the team should use development builds as the real mobile runtime, keep native customization in app config/config plugins, and avoid hand-editing generated `ios`/`android` directories unless intentionally leaving CNG. If Studienbuch needs a native affordance that Expo UI does not expose, an inline Expo module may now be a reasonable first-class option rather than a sign that the app has outgrown Expo.

Sources:

- [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
- [Expo Add custom native code](https://docs.expo.dev/workflow/customizing/)
- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)

### Local-First APIs Improved In SDK 56

The SDK 56 beta changelog is also relevant to the app's offline/local-first priority. The new `expo-file-system` API gains progress reporting, `AbortSignal` support, upload and download tasks, cancellation, resumable downloads, multi-file picking, multiple MIME types, Android SAF copy/move fixes, lower-memory large-file hashing, and experimental file/directory watching.

Expo SQLite also gained native `ArrayBuffer` support for blob columns, statement bind params, and session changesets.

Implication for Studienbuch: the native-feel strategy should not be only visual. If school data, attachments, exports, or sync queues become core flows, SDK 56's file-system and SQLite changes should shape the offline architecture. Real native progress, cancellation, resumability, and file watching can make offline workflows feel much more trustworthy under poor connectivity.

Source:

- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)

### Status And Navigation Bars Are Now More Declarative

SDK 56 aligns `expo-status-bar` and `expo-navigation-bar` behind a similar React component API. Multiple instances merge in mount order, and package plugin options are aligned.

Implication for Studienbuch: each route group can own its status/navigation bar style declaratively instead of relying on global imperative setup. This is useful for native fidelity because system chrome should respond to screen context, dark mode, sheets, and edge-to-edge Android behavior.

Source:

- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)

### Minimum Platform Versions Changed

The SDK 56 beta changelog bumps the minimum Xcode version to 26.4 and the minimum iOS/tvOS deployment target to 16.4. It also notes that this drops older Apple devices such as iPhone 7/7+, iPhone 6s/6s+, first-generation iPhone SE, iPad mini 4, and iPad Air 2.

Implication for Studienbuch: the iOS design target can assume newer platform baselines than older Expo SDKs allowed, but Liquid Glass still needs runtime gating because `expo-glass-effect` is iOS 26+. Product planning should explicitly decide whether losing those older Apple devices is acceptable for the intended school/student audience.

Source:

- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)

## Recommended Direction For Studienbuch

### 1. Define A Native Presentation Policy

Create a small policy for mobile UI decisions:

- Native navigation chrome beats custom chrome.
- Expo UI controls beat handcrafted React Native controls.
- Platform-specific components are allowed when conventions differ.
- Shared domain behavior belongs in `packages/core`; shared mobile presentation should be extracted only when it preserves native behavior.
- NativeWind/react-native-css are acceptable for layout, spacing, and custom content, but not as the main abstraction for buttons, pickers, switches, tabs, sheets, alerts, or system materials.

### 2. Build A Platform-Aware Component Layer

Add app-owned components that hide platform choices:

- `PlatformButton`
- `PlatformTextField`
- `PlatformList`
- `PlatformSection`
- `PlatformIcon`
- `PlatformSheet`
- `PlatformTabs`

These should be thin wrappers over Expo UI, Expo Router native tabs, `expo-symbols`, and React Native primitives. The wrapper layer prevents every feature screen from needing to know the Expo UI host details.

### 3. Keep Screens Product-Native, Not Pixel-Identical

For iOS:

- Prefer SwiftUI lists/forms for settings and structured school-life data.
- Lean on iOS navigation defaults.
- Use SF Symbols.
- Use Liquid Glass only for supported functional chrome on iOS 26+, with accessibility fallbacks.

For Android:

- Prefer Jetpack Compose Material 3 controls.
- Use Material Symbols.
- Use FABs for major creation actions when appropriate.
- Use Android sheets, snackbars, ripple feedback, and Material 3 spacing/shape conventions.
- Explore dynamic color if Expo UI exposes enough theming control for the chosen components; otherwise avoid manually approximating it too early.

### 4. Centralize Risky Or Beta APIs

The following APIs and integration points should be isolated:

- `expo-router/unstable-native-tabs`: alpha.
- `expo-symbols`: beta.
- `expo-glass-effect`: iOS 26+ and accessibility-sensitive.
- Expo Router Android toolbar and Stack v5: experimental.
- Expo UI platform-native components: production-ready according to Expo's SDK 56 beta changelog, but still new enough that local wrapper components will make API churn easier to handle.

Do not use these directly everywhere. Put them behind local adapters so breaking changes are cheap.

### 5. Verify On Real Platform Runtimes

Native fidelity cannot be judged from screenshots alone. Verification should include:

- iOS simulator and at least one physical iPhone if possible.
- Android emulator and at least one physical Android device if possible.
- Light/dark mode.
- Larger text sizes.
- Reduce motion.
- Reduce transparency on iOS.
- Offline startup and app resume.
- Tab reselection, back behavior, sheet dismissal, text input focus, keyboard avoidance, and scroll restoration.

## Suggested First Implementation Slice

The first useful slice should be small but representative:

1. Add a native-tab shell with placeholder routes for Today, Classes, Tasks, and Settings.
2. Add a centralized `PlatformIcon` mapping using `expo-symbols`.
3. Add route-owned `<StatusBar />` and `<NavigationBar />` usage for system chrome.
4. Build one settings-style screen using Expo UI universal components.
5. Build one creation flow using platform-native sheet/dialog behavior.
6. Compare iOS and Android on device/simulator and document mismatches before building more screens.

This will test the real integration points before the app accumulates custom UI debt.

## Follow-Up Research Questions

- Does Expo UI universal theming expose enough control for Studienbuch's brand while still preserving native appearance?
- Which Expo UI universal web APIs are too experimental to share with `apps/web`, and should mobile-only Expo UI wrappers avoid web support entirely?
- Should the mobile app standardize on Expo Router native tabs now, or wait until the API leaves alpha?
- What is the minimum iOS target for the app, and how much should Liquid Glass influence the design if many users are below iOS 26?
- How should Android dynamic color interact with Studienbuch's own icon and splash colors?
- Can SDK 56's `expo-file-system` tasks and Expo SQLite changesets cover the first version of local-first attachment and sync workflows?
