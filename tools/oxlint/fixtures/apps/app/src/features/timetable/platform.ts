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

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: the browser window
export const width = window.innerWidth;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: the page
export const title = document.title;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: the browser's navigator
export const online = navigator.onLine;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: local storage
export const draft = localStorage.getItem("draft");

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: session storage
export const tab = sessionStorage.getItem("tab");

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: IndexedDB
export const databases = indexedDB.databases();

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: a channel between tabs
export const tabs = new BroadcastChannel("tabs");

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: the window through globalThis
export const hasWindow = globalThis.window !== undefined;

// oxlint-disable-next-line studienbuch/no-global-process-runtime -- fixture: a typeof check
export const isBrowser = typeof document !== "undefined";

// A local of the same name and a property of that name read no host.
export const named = (document: { readonly title: string }) => document.title;
export const nested = { navigator: 1 }.navigator;

/** How many days the week shows side by side: all five on a wide web page, one on a phone. */
export function useVisibleDays() {
  const scheme = useColorScheme();

  return Platform.OS === "web" && scheme !== null && window.innerWidth > 600 ? 5 : 1;
}
