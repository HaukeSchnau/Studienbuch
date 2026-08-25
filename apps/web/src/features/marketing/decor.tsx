import { cn } from "#/ui/cn.ts";

/**
 * The legacy site's colour blobs.
 *
 * The silhouettes are the originals, kept because their asymmetry is what makes them read as blobs
 * rather than as ellipses. What changed is how they close. The originals were drawn to bleed past
 * their own viewBox, so bounding them anywhere sliced them along a straight line; here the run back
 * to the edge of the page is a curve, leaving exactly one straight edge — the one that meets the
 * side of the viewport and is meant to look cut.
 *
 * The original shipped them as PNG backgrounds swapped at a media query, pinning them to a fixed
 * size per breakpoint. As inline SVG they scale with whatever box they are given.
 */

const tones = {
  green: "var(--color-primary-pale)",
  blue: "var(--color-accent-pale)",
} as const;

/**
 * Presses in from the left. The outward sweep is the legacy green blob; only the return along the
 * bottom, which the original left as a straight line, is now a curve.
 */
const LeftBlob = ({ tone }: { tone: keyof typeof tones }) => (
  <svg
    aria-hidden
    className="h-full w-full"
    preserveAspectRatio="none"
    viewBox="-21 0 351 512"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M-21 0C15.25 9.43 96.79 42.97 132.91 101.69 178.05 175.08 148.64 246.7 262.87 282.95 354.26 311.96 328.31 407.04 303.91 450.96 250 488 120 508 -21 502Z"
      fill={tones[tone]}
    />
  </svg>
);

/**
 * Presses in from the right. This is the legacy blue blob, whose straight edge already ran down the
 * side of the page; the viewBox is widened so nothing is cropped.
 */
const RightBlob = ({ tone }: { tone: keyof typeof tones }) => (
  <svg
    aria-hidden
    className="h-full w-full"
    preserveAspectRatio="none"
    viewBox="-12 -52 629 1094"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M617 -40.1C438.74 -51 68.96 -45.58 15.96 63.26-50.3 199.32 105.43 273.53 196.27 239.96 287.11 206.39 373.85 221.4 279.6 489.09 204.19 703.24 453.08 937.59 586.95 1028L617 -40.1Z"
      fill={tones[tone]}
    />
  </svg>
);

/**
 * One blob, anchored to a side of the page. Callers position and size it; the shape stretches to
 * fill whatever box it is given, so keep the box roughly in the viewBox's proportions or the
 * silhouette flattens.
 *
 * The host section needs `relative isolate`, so the negative layer stays inside it instead of
 * dropping behind the page background.
 */
export const EdgeBlob = ({
  className,
  side,
  tone,
}: {
  className?: string;
  side: "left" | "right";
  tone: keyof typeof tones;
}) => (
  <div
    aria-hidden
    className={cn(
      "drift pointer-events-none absolute -z-10 opacity-45",
      side === "left" ? "left-0" : "right-0",
      className,
    )}
  >
    {side === "left" ? <LeftBlob tone={tone} /> : <RightBlob tone={tone} />}
  </div>
);
