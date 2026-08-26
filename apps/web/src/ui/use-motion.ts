import { useSyncExternalStore } from "react";

function mediaQueryStore(query: string, serverSnapshot: boolean) {
  return {
    subscribe: (onStoreChange: () => void) => {
      const media = globalThis.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => {
        media.removeEventListener("change", onStoreChange);
      };
    },
    getSnapshot: () => globalThis.matchMedia(query).matches,
    getServerSnapshot: () => serverSnapshot,
  };
}

const reducedMotion = mediaQueryStore("(prefers-reduced-motion: reduce)", true);
const finePointer = mediaQueryStore("(pointer: fine)", false);

/**
 * Whether motion is welcome.
 *
 * Starts `false` so the server and the first client render agree; anyone who has asked for reduced
 * motion sees the extra motion removed during hydration, before a frame that matters. The
 * subscription matters because the preference can be toggled while the page is open.
 *
 * CSS handles this on its own through `@media`. This exists for the effects that cannot be
 * expressed in CSS — SMIL, pointer tracking, playback rates — which no media query can reach.
 */
export function useMotionAllowed(): boolean {
  return !useSyncExternalStore(
    reducedMotion.subscribe,
    reducedMotion.getSnapshot,
    reducedMotion.getServerSnapshot,
  );
}

/**
 * Whether the visitor has a precise pointer.
 *
 * Pointer-driven effects are meaningless on a touchscreen — there is no hover, and reading a
 * finger's position mid-scroll produces nonsense — so they are simply not mounted there.
 */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    finePointer.subscribe,
    finePointer.getSnapshot,
    finePointer.getServerSnapshot,
  );
}
