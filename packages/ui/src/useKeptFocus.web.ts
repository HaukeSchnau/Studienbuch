/// <reference lib="dom" />
import { useLayoutEffect, useRef, type ComponentRef } from "react";
import type { View } from "react-native";

import type { KeptFocus } from "./useKeptFocus.ts";

// The control that had the keyboard focus last, and until when it takes the focus back. One at a
// time, as the page has one focus.
let kept: { readonly key: string; readonly until: number } | undefined;

// Longer than a list lets a used item linger before moving it (HomeworkPanel: 1.2 s).
const keepFor = 3000;

/**
 * useKeptFocus.ts on the web. A list moves an item by moving or re-creating its element, which
 * drops the focus to the page, or by moving the elements around it, which can leave it out of view.
 * The control that had the keyboard focus last takes it back after the move, and its item scrolls
 * into view, so Tab and a screen reader go on from where the student is. A mouse needs neither.
 */
export function useKeptFocus(key: string | undefined): KeptFocus {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const item = useRef<ComponentRef<typeof View>>(null);

  useLayoutEffect(() => {
    const element: unknown = ref.current;

    const mine = key !== undefined && kept?.key === key && Date.now() < kept.until;

    if (!mine || !(element instanceof HTMLElement)) return;

    if (document.activeElement === null || document.activeElement === document.body) {
      element.focus({ preventScroll: true });
    }

    const { left, right } = element.getBoundingClientRect();

    if (document.activeElement === element && (left < 0 || right > window.innerWidth)) {
      const shown: unknown = item.current;

      // The whole item, centred, so the first and last come back with the list's own padding.
      (shown instanceof HTMLElement ? shown : element).scrollIntoView({
        block: "nearest",
        inline: "center",
      });
    }
  });

  const keep = () => {
    const element: unknown = ref.current;

    if (!(element instanceof HTMLElement)) return;

    kept =
      key !== undefined && element.matches(":focus-visible")
        ? { key, until: Date.now() + keepFor }
        : undefined;
  };

  return { control: { ref, onFocus: keep, onUsed: keep }, item };
}
