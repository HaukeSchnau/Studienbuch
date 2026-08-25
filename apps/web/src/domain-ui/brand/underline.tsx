import type { ReactNode } from "react";

import { cn } from "#/ui/cn.ts";

/**
 * The swoosh reduced to a single stroke, for underlining a word. It is the same gesture the app
 * draws under its header, so a headline can carry the brand without a coloured band behind it.
 *
 * The stroke is normalised to `pathLength="1"` and fully dashed, which is what lets it be *drawn*:
 * animating `stroke-dashoffset` uncovers more of a curve that never moves, where scaling the SVG
 * stretches the curve as it grows and reads as a line being pulled rather than written.
 *
 * It inherits `currentColor`, so the nav can draw the same mark in white without a second copy.
 * Stretches to whatever it is placed under; `non-scaling-stroke` keeps the weight even as it does.
 */
export const Underline = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={cn("absolute inset-x-0 bottom-[0.04em] h-[0.16em] w-full", className)}
    preserveAspectRatio="none"
    viewBox="0 0 300 12"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 9C54 2 128 1 298 4"
      fill="none"
      pathLength={1}
      stroke="currentColor"
      strokeDasharray={1}
      strokeLinecap="round"
      strokeWidth="5"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/**
 * Wraps a word so {@link Underline} can sit beneath it without affecting line height. The offsets
 * are in `em`, so the stroke keeps the same relationship to the baseline at every headline size.
 */
export const Underlined = ({ children }: { children: ReactNode }) => (
  <span className="relative inline-block text-accent">
    <span className="text-primary-text">{children}</span>
    <Underline className="enter-underline" />
  </span>
);
