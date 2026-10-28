import { useEffect, useState, useSyncExternalStore } from "react";

// Media queries for the effects CSS can't switch off by itself: SMIL, pointer tracking and playback
// rates. CSS animations follow `prefers-reduced-motion` in site.css.
export * as Motion from "./Motion.ts";

const mediaQuery = (query: string, serverSnapshot: boolean) => ({
  subscribe: (onChange: () => void) => {
    const media = globalThis.matchMedia(query);
    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  },
  snapshot: () => globalThis.matchMedia(query).matches,
  serverSnapshot: () => serverSnapshot,
});

const reducedMotion = mediaQuery("(prefers-reduced-motion: reduce)", true);
const finePointer = mediaQuery("(pointer: fine)", false);

/**
 * Whether motion is welcome. False while prerendering and hydrating, so the prerendered page and the
 * first client render agree, and false whenever the visitor asks for reduced motion.
 */
export const useAllowed = () =>
  !useSyncExternalStore(
    reducedMotion.subscribe,
    reducedMotion.snapshot,
    reducedMotion.serverSnapshot,
  );

/**
 * Whether the visitor has a precise pointer, such as a mouse. False while prerendering and
 * hydrating. Pointer effects mean nothing under a finger.
 */
export const useFinePointer = () =>
  useSyncExternalStore(finePointer.subscribe, finePointer.snapshot, finePointer.serverSnapshot);

/**
 * The id of the section being read, out of `ids` in document order. The band is the middle of the
 * viewport, so the answer follows what the eye is on rather than what touches the top edge.
 */
export const useActiveSection = (ids: ReadonlyArray<string>) => {
  const [active, setActive] = useState<string>();

  useEffect(() => {
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }

        setActive(ids.findLast((id) => visible.has(id)));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const id of ids) {
      const element = document.getElementById(id);

      if (element !== null) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [ids]);

  return active;
};
