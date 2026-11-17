import { useRef, type ComponentRef } from "react";
import type { View } from "react-native";

/**
 * A ref for a view that takes the keyboard focus when it mounts while nothing else has it, such as
 * the error that a failed submit shows (useFocusWhenLost.web.ts). The phones keep the focus on the
 * control that was pressed and read the error out, so here the ref does nothing.
 */
export function useFocusWhenLost() {
  return useRef<ComponentRef<typeof View>>(null);
}
