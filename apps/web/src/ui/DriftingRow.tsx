import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import { Motion } from "./Motion.ts";

// How much faster the row runs at full scroll speed. Past about four it reads as a glitch.
const maximumBoost = 3.5;

/**
 * Speeds up the first CSS animation running on `element` while the page scrolls, and lets it coast
 * back to normal speed when scrolling stops. Does nothing when motion isn't welcome; restores the
 * normal rate on unmount. Speed follows the scroll position rather than wheel events, so a trackpad,
 * a dragged scrollbar and keyboard paging all count, and `playbackRate` changes speed without a jump.
 */
export function useScrollBoost(element: RefObject<HTMLElement | null>) {
  const motion = Motion.useAllowed();

  useEffect(() => {
    const animation = element.current?.getAnimations()[0];

    if (animation === undefined || !motion) return;

    let lastY = scrollY;
    let boost = 1;

    let frame = requestAnimationFrame(function tick() {
      const y = scrollY;
      const target = Math.min(1 + Math.abs(y - lastY) / 18, maximumBoost);
      lastY = y;
      // Rises with the scroll and falls back slowly, so stopping coasts rather than brakes.
      boost += (target - boost) * (target > boost ? 0.35 : 0.06);
      animation.playbackRate = boost;
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
      animation.playbackRate = 1;
    };
  }, [element, motion]);
}

/**
 * A row that drifts sideways forever, and runs faster while the page scrolls. `children` renders
 * twice, so translating by half the track lands the copy where the original began (`.drifting-row`
 * in site.css). Each item carries its own trailing margin; a `gap` would not halve with the track.
 */
export function DriftingRow({ children }: { children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  useScrollBoost(track);

  return (
    <div aria-hidden className="drifting-row">
      <div className="drifting-row-track" ref={track}>
        {children}
        {children}
      </div>
    </div>
  );
}
