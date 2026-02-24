# @stu/expo-native-example

Example Expo app and Storybook playground for `@stu/expo-native` components.

## Responsibilities

- Demonstrate native module behavior in isolation.
- Provide interactive stories for module development.

## Key Files

- `App.tsx`, `index.ts`: app/storybook entrypoints.
- `stories/`: component stories.
- `.storybook/`: Storybook configuration.

## Scripts

```bash
bun --filter @stu/expo-native-example dev
bun --filter @stu/expo-native-example start
bun --filter @stu/expo-native-example ios
bun --filter @stu/expo-native-example android
bun --filter @stu/expo-native-example storybook-generate
bun --filter @stu/expo-native-example lint
bun --filter @stu/expo-native-example typecheck
```

## Testing

No dedicated automated test suite is configured; manual validation occurs through Storybook and Expo runs.
