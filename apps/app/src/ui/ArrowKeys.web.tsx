import { useStableCallback } from "@stu/ui/useStableCallback";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import type { ArrowKeysProps } from "./ArrowKeys.tsx";

// Keys a field owns, where they move the caret.
const typing = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Calls `left` and `right` for the `←` and `→` keys while the screen is focused, unless a field
 * holds the focus or a modifier is down, which leaves the browser's own shortcuts alone.
 */
export function useArrowKeys({ left, right }: ArrowKeysProps) {
  const press = useStableCallback((event: KeyboardEvent) => {
    const target = event.target;

    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

    if (target instanceof HTMLElement && (typing.has(target.tagName) || target.isContentEditable)) {
      return;
    }

    const step = event.key === "ArrowLeft" ? left : event.key === "ArrowRight" ? right : undefined;

    if (step === undefined) return;

    event.preventDefault();
    step();
  });

  useFocusEffect(
    useCallback(() => {
      document.addEventListener("keydown", press);

      return () => document.removeEventListener("keydown", press);
    }, [press]),
  );
}

/** `useArrowKeys` where a screen draws it. */
export function ArrowKeys(props: ArrowKeysProps) {
  useArrowKeys(props);

  return null;
}
