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

## Current Landscape

### Expo SDK 56 And React Native 0.85

React Native 0.85 is the current stable React Native release as of the researched date, and the React Native team states that Expo SDK 56 includes React Native 0.85. The release adds the shared animation backend, React Native DevTools improvements, Metro TLS support, and several breaking changes such as the removal of `StyleSheet.absoluteFillObject`.

Expo SDK 55 and later run entirely on React Native's New Architecture. Expo explicitly says the New Architecture is always enabled and cannot be disabled in SDK 55+. This matters for native-feeling UI because the project should not plan around old-architecture compatibility escape hatches. Any third-party native library should be checked for New Architecture compatibility before adoption.

Implication for Studienbuch: the app is already on the modern path. Prefer maintained libraries that support Expo SDK 56 and RN 0.85, and be skeptical of older native UI packages that still assume the legacy architecture.

Sources:

- [React Native 0.85 release notes](https://reactnative.dev/blog/2026/04/07/react-native-0.85)
- [Expo New Architecture guide](https://docs.expo.dev/guides/new-architecture/)

### Expo UI Is The Key Native-Feel Primitive

`@expo/ui` is no longer just another React Native component kit. In SDK 56, Expo documents three relevant layers:

- Universal components from `@expo/ui`, which use one API and delegate to platform-native UI toolkits on Android and iOS.
- `@expo/ui/swift-ui`, which renders SwiftUI views from React Native.
- `@expo/ui/jetpack-compose`, which renders Jetpack Compose views from React Native.

Expo's universal docs say the platform-native look and feel is preserved because the universal components delegate to Jetpack Compose and SwiftUI. The platform-specific docs confirm that SwiftUI components must be wrapped in `Host`, and Jetpack Compose components must also be wrapped in their own `Host`.

The important architectural idea is the `Host` boundary: native subtrees should be deliberate islands inside the React Native app. They are ideal for controls, forms, settings screens, sheets, pickers, lists, toggles, sliders, date pickers, and other UI where users already expect system behavior.

Implication for Studienbuch: use Expo UI as the default for controls and settings-like screens. Use universal Expo UI first when the same structure makes sense on both platforms; use `swift-ui` or `jetpack-compose` directly when the platform conventions diverge.

Sources:

- [Expo UI Universal components](https://docs.expo.dev/versions/v56.0.0/sdk/ui/universal/)
- [Expo UI SwiftUI components](https://docs.expo.dev/versions/v56.0.0/sdk/ui/swift-ui/)
- [Expo UI Jetpack Compose components](https://docs.expo.dev/versions/v56.0.0/sdk/ui/jetpack-compose/)
- [Building SwiftUI apps with Expo UI](https://docs.expo.dev/guides/expo-ui-swift-ui/)

### Navigation Should Use Native Chrome Where It Matters

Expo Router now documents native tabs through `expo-router/unstable-native-tabs`. The API is alpha, but it exists specifically to use the native system tab bar instead of a JavaScript tab bar. It also supports platform-native behaviors such as tapping the active tab to scroll to top, which is available on Android in SDK 55+ and is a familiar convention on iOS.

Implication for Studienbuch: if the app uses a tabbed structure, prototype with native tabs early. Do not over-style the tab bar. Use native item labels, system icon mappings, and platform behavior. Because native tabs are alpha, isolate the tab layout so it can be swapped if Expo changes the API.

Sources:

- [Expo Router native tabs guide](https://docs.expo.dev/router/advanced/native-tabs/)
- [Expo Router native tabs SDK reference](https://docs.expo.dev/versions/v56.0.0/sdk/router-native-tabs/)

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

Implication for Studienbuch: native-first UI does not require ejecting. It does mean the team should use development builds as the real mobile runtime, keep native customization in app config/config plugins, and avoid hand-editing generated `ios`/`android` directories unless intentionally leaving CNG.

Sources:

- [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
- [Expo Add custom native code](https://docs.expo.dev/workflow/customizing/)

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

The following APIs are promising but should be isolated:

- `expo-router/unstable-native-tabs`: alpha.
- `expo-symbols`: beta.
- `expo-glass-effect`: iOS 26+ and accessibility-sensitive.
- Expo UI platform-native components: powerful, but still a fast-moving SDK 56 area.

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
3. Build one settings-style screen using Expo UI universal components.
4. Build one creation flow using platform-native sheet/dialog behavior.
5. Compare iOS and Android on device/simulator and document mismatches before building more screens.

This will test the real integration points before the app accumulates custom UI debt.

## Follow-Up Research Questions

- Does Expo UI universal theming expose enough control for Studienbuch's brand while still preserving native appearance?
- Which Expo UI components are stable enough for production in SDK 56, and which still need fallback React Native implementations?
- Should the mobile app standardize on Expo Router native tabs now, or wait until the API leaves alpha?
- What is the minimum iOS target for the app, and how much should Liquid Glass influence the design if many users are below iOS 26?
- How should Android dynamic color interact with Studienbuch's own icon and splash colors?
