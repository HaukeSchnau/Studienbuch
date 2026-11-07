/// <reference lib="dom" />
import { useEffect, useRef, type ComponentRef } from "react";
import type { View } from "react-native";

/**
 * useFocusOnMount.ts on the web: the view's element takes the keyboard focus, so a screen reader
 * reads it and Tab continues from there. Give the view `tabIndex={-1}`.
 */
export function useFocusOnMount() {
  const ref = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    const element: unknown = ref.current;

    if (element instanceof HTMLElement) element.focus({ preventScroll: true });
  }, []);

  return ref;
}
