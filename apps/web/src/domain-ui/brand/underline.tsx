import { cn } from "#/ui/cn.ts";

/**
 * The swoosh reduced to a single stroke, for underlining a word. It is the same gesture the app
 * draws under its header, so a headline can carry the brand without a coloured band behind it.
 *
 * Stretches to whatever it is placed under; `non-scaling-stroke` keeps the weight even as it does.
 */
export const Underline = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    // Offsets are in `em` so the stroke keeps the same relationship to the baseline at every
    // headline size. Anchoring to the element box instead would drop it into the line's descender
    // space, where it reads as a horizontal rule rather than a mark over the word.
    className={cn("absolute inset-x-0 bottom-[0.22em] h-[0.16em] w-full", className)}
    preserveAspectRatio="none"
    viewBox="0 0 300 12"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 9C54 2 128 1 298 4"
      fill="none"
      stroke="var(--color-accent)"
      strokeLinecap="round"
      strokeWidth="5"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** Wraps a word so {@link Underline} can sit beneath it without affecting line height. */
export const Underlined = ({ children }: { children: React.ReactNode }) => (
  <span className="relative inline-block">
    {children}
    <Underline />
  </span>
);
