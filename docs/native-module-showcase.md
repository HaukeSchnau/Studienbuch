# Native Module Showcase

This repo now contains two tiny Expo native-code examples that are intentionally safe to build and run:

- Inline module: `apps/mobile/src/native/StudienbuchInlineModule.swift` and `apps/mobile/src/native/StudienbuchInlineModule.kt`
- Local Expo module: `apps/mobile/modules/native-module-demo`

The mobile app's first screen calls both modules and renders their source boundary plus a native platform string returned by Swift or Kotlin.

It also renders one native component from the local Expo module:

- `apps/mobile/modules/native-module-demo/ios/StudienbuchNativeBadgeView.swift`
- `apps/mobile/modules/native-module-demo/android/src/main/java/dev/schnau/studienbuch/localmodule/StudienbuchNativeBadgeView.kt`
- `apps/mobile/modules/native-module-demo/src/StudienbuchNativeBadgeView.tsx`

## Inline Module

The inline module is enabled in `apps/mobile/app.config.ts`:

```ts
experiments: {
  inlineModules: {
    watchedDirectories: ["src/native"],
  },
}
```

This is the smallest shape for app-owned native code. The Swift and Kotlin files live next to the mobile source tree, and Expo discovers them during prebuild.

Use this shape when the native capability is narrow and belongs only to this app.

## Local Expo Module

The local module lives under `apps/mobile/modules/native-module-demo`. It has:

- native registration config in `expo-module.config.json`
- native implementations in `ios/` and `android/`
- a typed JavaScript entrypoint in `src/StudienbuchLocalModule.ts`
- a native React component wrapper in `src/StudienbuchNativeBadgeView.tsx`
- a public re-export in `index.ts`

Use this shape when the native capability is still Studienbuch-specific, but large enough to deserve its own boundary.

The native component is registered from the module definition:

```swift
View(StudienbuchNativeBadgeView.self) {
  Prop("title") { (view, title: String) in
    view.title = title
  }
}
```

```kotlin
View(StudienbuchNativeBadgeView::class) {
  Prop("title") { view: StudienbuchNativeBadgeView, title: String ->
    view.title = title
  }
}
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

Native code is compiled into a development build. Fast Refresh will update TypeScript changes, but Swift and Kotlin changes require rebuilding the native app.

From the repo root:

```sh
bun run --cwd apps/mobile dev:dev-client
```

That runs the existing iOS development-client script. For Android, run Expo directly from the mobile app directory:

```sh
cd apps/mobile
bunx expo run:android
```

After changing `app.config.ts` or moving native files, regenerate the native projects:

```sh
cd apps/mobile
bunx expo prebuild --clean
```

The generated `ios/` and `android/` folders are ignored in this repo.
