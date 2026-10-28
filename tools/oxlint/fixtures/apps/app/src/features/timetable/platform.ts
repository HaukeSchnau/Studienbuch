import * as NodeOS from "node:os";
import * as ReactNative from "react-native";
import { Platform, useColorScheme } from "react-native";

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: Platform.OS in feature code
export const isWeb = Platform.OS === "web";

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: Platform.select in feature code
export const gap = Platform.select({ ios: 8, default: 12 });

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: the OS version
export const version = Platform.Version;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: destructured from Platform
export const { isPad } = Platform;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: through a namespace import
export const isAndroid = ReactNative.Platform.OS === "android";

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: Expo's build-time platform
export const expoOs = process.env.EXPO_OS;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: the host's platform
export const host = process.platform;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: the host's architecture
export const architecture = NodeOS.arch();

/** How many days the week shows side by side: all five on the web, one on a phone. */
export function useVisibleDays() {
  const scheme = useColorScheme();

  return Platform.OS === "web" && scheme !== null ? 5 : 1;
}
