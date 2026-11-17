/// <reference lib="dom" />
import { useEffect, useRef, type ComponentRef } from "react";
import type { View } from "react-native";

/**
 * useFocusWhenLost.ts on the web. A submit blurs its field, and a button that turns busy drops the
 * focus to the page, so the view takes it when it mounts, and Tab goes on from there. Focus that
 * landed somewhere on purpose stays. Give the view `tabIndex={-1}`.
 */
export function useFocusWhenLost() {
  const ref = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    const element: unknown = ref.current;
    const lost = document.activeElement === null || document.activeElement === document.body;

    if (lost && element instanceof HTMLElement) element.focus({ preventScroll: true });
  }, []);

  return ref;
}
