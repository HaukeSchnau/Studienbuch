# @stu/expo-native

Custom Expo native modules used by mobile clients.

## Responsibilities

- Provide native-backed drawing and select UI modules.
- Expose typed React components over Expo module bindings.

## Public Surface

From `src/index.ts`:
- `DrawingView` (+ `DrawingViewRef`)
- `SelectView`

## Key Files

- `src/DrawingModule.tsx`
- `src/SelectModule.tsx`
- `android/`, `ios/`: native implementation projects

## Scripts

```bash
bun --filter @stu/expo-native lint
bun --filter @stu/expo-native typecheck
bun --filter @stu/expo-native open:ios
bun --filter @stu/expo-native open:android
```

## Testing

No package-local automated suite is currently configured.
Validation is done through integration in `@stu/app-mobile` and `@stu/expo-native-example`.
