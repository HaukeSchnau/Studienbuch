import type { ReactNode } from "react";

/**
 * The app's swoosh reduced to one stroke, drawn under a word. It inherits `currentColor` and
 * stretches to whatever it sits under; `non-scaling-stroke` keeps its weight while it does. Motion
 * reveals it with a clip wipe (site.css): a dashed stroke and a stretched viewBox disagree about the
 * path's length and leave a gap.
 */
export function Underline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={`underline ${className ?? ""}`}
      preserveAspectRatio="none"
      viewBox="0 0 300 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 9C54 2 128 1 298 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A word with the swoosh beneath it. The swoosh draws itself after the headline arrives. */
export function Underlined({ children }: { children: ReactNode }) {
  return (
    <span className="underlined">
      {children}
      <Underline className="underline-enter" />
    </span>
  );
}
