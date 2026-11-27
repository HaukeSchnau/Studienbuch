/// <reference lib="dom" />
import { useRef, type ComponentRef } from "react";
import type { View } from "react-native";

/**
 * useRefocus.ts on the web: the control's element takes the keyboard focus on `refocus`, so focus
 * doesn't fall back to the page when the part it opened unmounts.
 */
export function useRefocus() {
  const ref = useRef<ComponentRef<typeof View>>(null);

  return {
    ref,
    refocus: () => {
      const element: unknown = ref.current;

      if (element instanceof HTMLElement) element.focus();
    },
  };
}
