# Native Module Showcase

Last verified: 2026-05-21

This document is the durable reference for the native-code showcase in `apps/mobile`. It covers what exists, how the pieces are wired, when to choose inline versus local Expo modules, and how to iterate without rebuilding more than necessary.

## Current Showcase

The mobile app renders four native-code examples on the first screen:

- Inline native module: `apps/mobile/src/native/StudienbuchInlineModule.swift`, `apps/mobile/src/native/StudienbuchInlineModule.kt`, and `apps/mobile/src/native/StudienbuchInlineModule.ts`
- Inline native component: `apps/mobile/src/native/StudienbuchInlineBadgeView.swift`, `apps/mobile/src/native/StudienbuchInlineBadgeView.kt`, and `apps/mobile/src/native/StudienbuchInlineBadgeView.tsx`
- Local Expo module: `apps/mobile/modules/native-module-demo`
- Local native component: `apps/mobile/modules/native-module-demo/ios/StudienbuchNativeBadgeView.swift`, `apps/mobile/modules/native-module-demo/android/src/main/java/dev/schnau/studienbuch/localmodule/StudienbuchNativeBadgeView.kt`, and `apps/mobile/modules/native-module-demo/src/StudienbuchNativeBadgeView.tsx`

The examples are intentionally simple and safe: they return platform strings and render native badges. Their purpose is to show the shapes of native code, not to introduce product behavior.

## Decision Rule

Use this progression:

```txt
React Native only
-> inline module to prove the native bit
-> local Expo module once the API shape is clear
-> standalone Expo module only if it must be reused outside Studienbuch
```

For Studienbuch, prefer local Expo modules for product-critical native capabilities. Inline modules are good for spikes, tiny app-owned escape hatches, and short-lived probes.

## Inline Versus Local

| Topic                      | Inline module                                           | Local Expo module                                               |
| -------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Best fit                   | Small app-only native code                              | Durable native capability                                       |
| Current SDK status         | Experimental in Expo SDK 56                             | Stable Expo Modules path                                        |
| File location              | `apps/mobile/src/native`                                | `apps/mobile/modules/<name>`                                    |
| Native discovery           | `expo.experiments.inlineModules.watchedDirectories`     | Expo autolinking plus `expo-module.config.json`                 |
| JS access                  | `requireNativeModule` / `requireNativeView` from `expo` | Module entrypoint and wrappers under `src/`                     |
| Setup files                | Minimal                                                 | `ios/`, `android/`, `src/`, module config, podspec/Gradle files |
| API boundary               | Easy to blur                                            | Clear package-like boundary                                     |
| Config/plugins/permissions | Awkward                                                 | Better fit                                                      |
| Reuse                      | Poor                                                    | Good within the app, easier to promote later                    |
| Deletion/refactor cost     | Low                                                     | Moderate                                                        |

Choose inline when:

- The code is a quick experiment.
- The capability belongs only to `apps/mobile`.
- The native surface is one small module or view.
- You expect to delete or rewrite it soon.
- You are validating whether an OS/native API is worth pursuing.

Choose a local Expo module when:

- The capability has a name and a long-lived boundary.
- It has multiple native files, props, events, functions, helpers, or assets.
- Multiple screens will depend on it.
- It needs permissions, config plugins, native resources, or platform setup.
- You want future agents to understand the API without digging through app routes.
- It may later move into a standalone package.

## Inline Module Anatomy

Inline modules are enabled in `apps/mobile/app.config.ts`:

```ts
experiments: {
  inlineModules: {
    watchedDirectories: ["src/native"],
  },
}
```

The TypeScript side loads the module directly:

```ts
import { NativeModule, requireNativeModule } from "expo";

declare class StudienbuchInlineModule extends NativeModule {
  moduleKind: "inline";
  getModuleBoundary(): string;
  getPlatformSummary(): string;
}

export default requireNativeModule<StudienbuchInlineModule>("StudienbuchInlineModule");
```

The Swift and Kotlin files define the native API:

```swift
internal import ExpoModulesCore
import UIKit

class StudienbuchInlineModule: Module {
  public func definition() -> ModuleDefinition {
    Constant("moduleKind") {
      "inline"
    }

    Function("getPlatformSummary") { () -> String in
      let device = UIDevice.current
      return "\(device.systemName) \(device.systemVersion) via Swift inline module"
    }
  }
}
```

```kotlin
package dev.schnau.studienbuch.inline

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class StudienbuchInlineModule : Module() {
  override fun definition() = ModuleDefinition {
    Constant("moduleKind") {
      "inline"
    }

    Function("getPlatformSummary") {
      "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT}) via Kotlin inline module"
    }
  }
}
```

## Inline Native Component Anatomy

Inline native views are registered from a `Module` class in the app source tree. React consumes them with `requireNativeView`.

```tsx
import { requireNativeView } from "expo";
import type { ViewProps } from "react-native";

export type StudienbuchInlineBadgeViewProps = {
  title: string;
  accentColor?: string;
} & ViewProps;

const NativeView = requireNativeView<StudienbuchInlineBadgeViewProps>("StudienbuchInlineBadgeView");
```

Swift registration:

```swift
class StudienbuchInlineBadgeView: Module {
  public func definition() -> ModuleDefinition {
    View(StudienbuchInlineBadgeNativeView.self) {
      Prop("title") { (view, title: String) in
        view.title = title
      }

      Prop("accentColor") { (view, accentColor: String) in
        view.accentColor = accentColor
      }
    }
  }
}
```

Kotlin registration:

```kotlin
class StudienbuchInlineBadgeView : Module() {
  override fun definition() = ModuleDefinition {
    View(StudienbuchInlineBadgeNativeView::class) {
      Prop("title") { view: StudienbuchInlineBadgeNativeView, title: String ->
        view.title = title
      }

      Prop("accentColor") { view: StudienbuchInlineBadgeNativeView, accentColor: String ->
        view.accentColor = accentColor
      }
    }
  }
}
```

The native view class owns the actual platform UI. In the showcase, iOS uses `UILabel` in an `ExpoView`, while Android uses `TextView` in an `ExpoView`.

## Local Expo Module Anatomy

The local module lives under `apps/mobile/modules/native-module-demo`. It has:

- `expo-module.config.json` for autolinking registration.
- `ios/StudienbuchLocalModule.swift` for the iOS module definition.
- `ios/StudienbuchNativeBadgeView.swift` for the iOS native component.
- `android/src/main/java/dev/schnau/studienbuch/localmodule/StudienbuchLocalModule.kt` for the Android module definition.
- `android/src/main/java/dev/schnau/studienbuch/localmodule/StudienbuchNativeBadgeView.kt` for the Android native component.
- `src/StudienbuchLocalModule.ts` for the typed JS module entrypoint.
- `src/StudienbuchNativeBadgeView.tsx` for the typed React component wrapper.
- `index.ts` for public exports.

The module config names the native modules:

```json
{
  "platforms": ["apple", "android"],
  "apple": {
    "modules": ["StudienbuchLocalModule"]
  },
  "android": {
    "modules": ["dev.schnau.studienbuch.localmodule.StudienbuchLocalModule"]
  }
}
```

The React wrapper uses `requireNativeViewManager`:

```tsx
import { requireNativeViewManager } from "expo-modules-core";
import type { ViewProps } from "react-native";

export type StudienbuchNativeBadgeViewProps = {
  title: string;
  accentColor?: string;
} & ViewProps;

const NativeView =
  requireNativeViewManager<StudienbuchNativeBadgeViewProps>("StudienbuchLocalModule");
```

React renders it like any other component:

```tsx
<StudienbuchNativeBadgeView
  title="Native school-life component"
  accentColor="#2f7d69"
  style={{ height: 54, width: "100%" }}
/>
```

## Build And Run

Native code is compiled into a development build. Fast Refresh updates TypeScript and React changes, but Swift and Kotlin changes require native recompilation.

From the repo root, run the existing iOS development-client script:

```sh
bun run --cwd apps/mobile dev:dev-client
```

For Android, run Expo from the mobile app directory:

```sh
cd apps/mobile
bunx expo run:android
```

Generated `ios/` and `android/` folders are ignored in this repo.

## Iteration Workflow

Avoid `prebuild --clean` by default. Use the smallest loop that matches the change.

| Change                                                                 | Fastest loop                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| React screen layout, props, copy, TS wrapper                           | Fast Refresh from the dev client                                         |
| Existing Swift/Kotlin implementation body                              | Incremental native rebuild with `expo run:ios`, Xcode, or Android Studio |
| New Swift/Kotlin file                                                  | `expo prebuild`, then incremental native rebuild                         |
| `app.config.ts` native config                                          | `expo prebuild --clean`, then native rebuild                             |
| `expo-module.config.json`, podspec, Gradle, permissions, config plugin | `expo prebuild --clean`, then native rebuild                             |
| New native dependency                                                  | Install dependency, prebuild/rebuild the development client              |

Recommended iOS loop while actively editing existing native files:

```sh
cd apps/mobile
bunx expo prebuild
open ios/Studienbuch.xcworkspace
```

Then press Run in Xcode. Xcode incremental builds are usually faster than invoking a clean Expo build every time, and debugger/breakpoints are available.

Recommended Android loop:

```sh
cd apps/mobile
bunx expo prebuild
open -a "Android Studio" android
```

Then use Android Studio's incremental build, Logcat, and debugger.

Only use the clean prebuild reset when the generated project may be stale:

```sh
cd apps/mobile
bunx expo prebuild --clean --no-install
```

## Debugging Native Code

For iOS:

- Open `apps/mobile/ios/Studienbuch.xcworkspace`.
- Set Swift breakpoints inside native module or view files.
- Use Xcode's console for native logs.
- Re-run from Xcode after Swift changes.
- If an inline module is not found, rerun prebuild and verify `apps/mobile/ios/Podfile.properties.json` contains `expo.inlineModules.watchedDirectories`.

For Android:

- Open `apps/mobile/android` in Android Studio.
- Set Kotlin breakpoints inside native module or view files.
- Use Logcat for native logs.
- Re-run from Android Studio after Kotlin changes.
- If an inline module is not found, rerun prebuild and verify `apps/mobile/android/gradle.properties` contains `expo.inlineModules.watchedDirectories`.

For JavaScript/native boundary issues:

- Add `import "expo-dev-client";` in the root app entry if extra dev-client diagnostics are needed.
- Confirm the TypeScript wrapper calls the correct native name.
- Confirm the module definition has `Name("...")` for normal modules.
- Confirm native view wrappers use `requireNativeView(...)` for inline views and `requireNativeViewManager(...)` for local module views.

## Promotion Checklist

Promote inline code to a local Expo module when any of these become true:

- It has more than one native view or module function.
- It needs events, callbacks, or shared native helper types.
- It needs native resources, permissions, config plugins, or platform setup.
- It needs durable docs/tests.
- More than one app screen depends on it.
- A future standalone module seems plausible.

Promote a local module to a standalone Expo module when:

- It should be reused outside `apps/mobile`.
- It needs its own example app for faster native iteration.
- It should be versioned or published independently.
- It needs a smaller fixture app than Studienbuch for native development.

Standalone modules are the best loop for serious native feature work because `create-expo-module` can generate a small example app plus scripts such as `open:ios` and `open:android`.

## Verification Commands

Use the repo-required full QA before considering a task complete:

```sh
just qa
```

Useful targeted checks while editing native code:

```sh
bun run --cwd apps/mobile test
bun run oxlint --disable-nested-config --report-unused-disable-directives apps/mobile docs/native-module-showcase.md
cd apps/mobile && bunx expo prebuild --clean --no-install
```

Useful autolinking check for the local module:

```sh
cd apps/mobile
bunx expo-modules-autolinking resolve --platform apple --json | rg 'native-module-demo|StudienbuchLocalModule'
bunx expo-modules-autolinking resolve --platform android --json | rg 'native-module-demo|StudienbuchLocalModule'
```

## Sources

- [Expo SDK 56 beta changelog](https://expo.dev/changelog/sdk-56-beta)
- [Expo inline modules tutorial](https://docs.expo.dev/modules/inline-modules-tutorial/)
- [Expo native view tutorial](https://docs.expo.dev/modules/native-view-tutorial/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/)
- [create-expo-module](https://docs.expo.dev/more/create-expo-module)
- [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
