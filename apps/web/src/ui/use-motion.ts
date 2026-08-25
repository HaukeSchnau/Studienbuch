import { useEffect, useState } from "react";

const query = "(prefers-reduced-motion: reduce)";

/**
 * Whether motion is welcome.
 *
 * Starts `false` so the server and the first client render agree; anyone who has asked for reduced
 * motion sees the extra motion removed on the first effect, before a frame that matters. The
 * subscription matters because the preference can be toggled while the page is open.
 *
 * CSS handles this on its own through `@media`. This exists for the effects that cannot be
 * expressed in CSS — SMIL, pointer tracking, playback rates — which no media query can reach.
 */
export function useMotionAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const media = globalThis.matchMedia(query);
    const sync = () => {
      setAllowed(!media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  return allowed;
}

/**
 * Whether the visitor has a precise pointer.
 *
 * Pointer-driven effects are meaningless on a touchscreen — there is no hover, and reading a
 * finger's position mid-scroll produces nonsense — so they are simply not mounted there.
 */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const media = globalThis.matchMedia("(pointer: fine)");
    const sync = () => {
      setFine(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  return fine;
}
