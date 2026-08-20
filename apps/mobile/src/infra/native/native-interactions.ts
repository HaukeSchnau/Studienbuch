import { haptics } from "./haptics";

export const nativeInteraction = {
  selection: () => haptics.selection(),
  toggle: (nextValue: boolean) => haptics.toggle(nextValue),
  success: () => haptics.success(),
  warning: () => haptics.warning(),
  error: () => haptics.error(),
} as const;

export const nativeComponentPolicy = {
  defaultLayer: "expo-ui",
  fallbackLayer: "react-native",
  customNativeWhen: [
    "Expo UI has no suitable cross-platform abstraction.",
    "The interaction depends on platform-specific system behavior.",
    "A React Native implementation cannot preserve predictable offline-first app behavior.",
  ],
} as const;
