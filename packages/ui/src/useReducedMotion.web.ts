/// <reference lib="dom" />
import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void) => {
  const media = globalThis.matchMedia(query);

  media.addEventListener("change", onChange);

  return () => media.removeEventListener("change", onChange);
};

/**
 * useReducedMotion.ts on the web: the media query, read again whenever it changes. A prerendered
 * page carries the motion, and hydration drops it where the query asks for less.
 */
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia(query).matches,
    () => false,
  );
}
