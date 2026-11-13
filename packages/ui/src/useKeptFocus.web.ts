/// <reference lib="dom" />
import { useLayoutEffect, useRef, type ComponentRef } from "react";
import type { View } from "react-native";

// The control last used from the keyboard, and until when it takes the focus back. One at a time,
// as the page has one focus.
let used: { readonly key: string; readonly until: number } | undefined;

// Longer than a list lets a used item linger before moving it (HomeworkPanel: 1.2 s).
const keepFor = 3000;

/**
 * useKeptFocus.ts on the web. A list moves a ticked card by moving or re-creating its element,
 * which drops the focus to the page, or by moving the elements around it, which can leave it out of
 * view. When the control was used from the keyboard, the control with the same `key` takes the
 * focus back after the move and scrolls into view, so Tab and a screen reader go on from there.
 */
export function useKeptFocus(key: string | undefined) {
  const ref = useRef<ComponentRef<typeof View>>(null);

  useLayoutEffect(() => {
    const element: unknown = ref.current;

    const mine = key !== undefined && used?.key === key && Date.now() < used.until;

    if (!mine || !(element instanceof HTMLElement)) return;

    if (document.activeElement === null || document.activeElement === document.body) {
      element.focus({ preventScroll: true });
    }

    const { left, right } = element.getBoundingClientRect();

    if (document.activeElement === element && (left < 0 || right > window.innerWidth)) {
      element.scrollIntoView({ block: "nearest", inline: "center" });
    }
  });

  return {
    ref,
    onUsed: () => {
      const element: unknown = ref.current;

      if (
        key !== undefined &&
        element instanceof HTMLElement &&
        element.matches(":focus-visible")
      ) {
        used = { key, until: Date.now() + keepFor };
      }
    },
  };
}
