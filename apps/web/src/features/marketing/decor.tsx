import { cn } from "#/ui/cn.ts";

/**
 * The legacy site's colour blobs, as a small family rather than one silhouette used twice.
 *
 * Every silhouette is drawn left-anchored and closed the same way: an opening cubic, then `S`
 * segments, which reflect the previous control point and so guarantee a smooth join at every seam.
 * The only straight edge is the one at x=0, where the silhouette meets the side of the page and is meant
 * to look cut. Hand-writing the return curve instead is what produced the kink in the last version.
 *
 * A silhouette is mirrored onto the right-hand side and flipped vertically with CSS rather than being
 * redrawn, so four paths cover sixteen placements.
 */

const silhouettes = {
  /** Round and bottom-heavy, closest to the legacy green blob. */
  lobe: {
    viewBox: "0 0 340 600",
    d: "M0 20C60 8 150 40 210 120S340 300 300 420S140 600 0 570Z",
  },
  /** A teardrop, widest near the top and tapering away. */
  crest: {
    viewBox: "0 0 400 520",
    d: "M0 10C160 0 320 60 356 170S300 380 170 440S60 520 0 500Z",
  },
  /** Two lobes with a pinch between them — the one with real personality. */
  notch: {
    viewBox: "0 0 340 580",
    d: "M0 24C130 10 254 64 300 158S236 250 206 300S300 400 262 470S110 580 0 548Z",
  },
  /** Narrow and tall, for edges with little room to spare. */
  sliver: {
    viewBox: "0 0 220 620",
    d: "M0 30C70 16 150 70 176 170S200 400 130 500S50 610 0 590Z",
  },
} as const;

const tones = {
  green: "var(--color-primary-pale)",
  blue: "var(--color-accent-pale)",
} as const;

/**
 * One blob, anchored to a side of the page. Callers position and size it; keep the box roughly in
 * the silhouette's own proportions or the silhouette flattens.
 *
 * The host section needs `relative isolate`, so the negative layer stays inside it instead of
 * dropping behind the page background — and the blob must fit inside that section's box, because
 * anything that overhangs is cut off square where the next section's background starts.
 */
export const EdgeBlob = ({
  className,
  flip = false,
  silhouette,
  side,
  tone,
}: {
  className?: string;
  /** Mirror vertically, so the same silhouette can lead with its other end. */
  flip?: boolean;
  silhouette: keyof typeof silhouettes;
  side: "left" | "right";
  tone: keyof typeof tones;
}) => {
  const { d, viewBox } = silhouettes[silhouette];

  return (
    // The drift animation owns the outer element's transform, so mirroring has to happen on an
    // inner one or the two overwrite each other.
    <div
      aria-hidden
      className={cn(
        "drift pointer-events-none absolute -z-10 opacity-45",
        side === "left" ? "left-0" : "right-0",
        className,
      )}
    >
      <div
        className="h-full w-full"
        style={{ transform: `scale(${side === "right" ? -1 : 1}, ${flip ? -1 : 1})` }}
      >
        <svg
          aria-hidden
          className="h-full w-full"
          preserveAspectRatio="none"
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={d} fill={tones[tone]} />
        </svg>
      </div>
    </div>
  );
};
