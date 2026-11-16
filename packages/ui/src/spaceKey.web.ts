import type { PressableProps } from "react-native";

/**
 * spaceKey.ts on the web: react-native-web presses on Space only for role "button" (its
 * PressResponder's `isValidKeyPress`), so Space presses on release, as a browser's checkbox does,
 * and its keydown doesn't scroll the page. Remove once react-native-web takes Space on these roles.
 */
export const spaceKey = (press: () => void): Pick<PressableProps, "onKeyDown" | "onKeyUp"> => ({
  onKeyDown: (event) => {
    if (event.nativeEvent.key === " ") event.preventDefault();
  },
  onKeyUp: (event) => {
    if (event.nativeEvent.key === " ") press();
  },
});
