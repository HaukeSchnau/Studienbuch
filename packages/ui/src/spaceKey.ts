import type { PressableProps } from "react-native";

/**
 * The key handlers that let Space press a checkbox or radio (spaceKey.web.ts). The phones need
 * none: Android already clicks a focused view on Space, and a second press would undo it.
 */
export const spaceKey = (_press: () => void): Pick<PressableProps, "onKeyDown" | "onKeyUp"> => ({});
