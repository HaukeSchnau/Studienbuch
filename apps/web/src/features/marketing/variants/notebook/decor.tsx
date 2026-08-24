import type { ReactNode } from "react";

import { cn } from "#/ui/cn.ts";

/**
 * The binding rings from `branding/logo/app-icon.svg`, running the full height of whatever they are
 * placed in.
 *
 * An SVG `<pattern>` tiles them rather than a repeated background image, so the rail adapts to any
 * page height without anyone having to know how tall the page is. That is also why it spans the
 * document instead of being fixed to the viewport: one binding down the whole page, not a rail that
 * hangs still while the page moves past it.
 */
export const SpiralRail = ({ className }: { className?: string }) => (
  <svg aria-hidden className={cn("h-full w-16", className)} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern height="72" id="binding-ring" patternUnits="userSpaceOnUse" width="64">
        {/* The wire loops out to the left of the cover and back. */}
        <ellipse
          cx="26"
          cy="36"
          fill="none"
          rx="21"
          ry="7"
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="2"
        />
        <circle cx="45" cy="36" fill="var(--color-primary-pale)" r="10" />
      </pattern>
    </defs>
    <rect fill="url(#binding-ring)" height="100%" width="100%" />
  </svg>
);

/**
 * A sheet of ruled paper with two more sheets fanned out behind it, the way the pages sit behind the
 * cover in the logo. Sections of the page are these.
 */
export const PaperPage = ({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) => (
  <section className={cn("relative", className)} id={id}>
    {/* The sheets underneath. Rotated a fraction of a degree each so the stack looks handled. */}
    <div
      aria-hidden
      className="absolute inset-y-5 right-0 left-10 rotate-[1.2deg] rounded-3xl bg-white/45 shadow-card"
    />
    <div
      aria-hidden
      className="absolute inset-y-3 right-0 left-5 rotate-[0.6deg] rounded-3xl bg-white/70 shadow-card"
    />

    <div className="relative overflow-hidden rounded-3xl bg-surface px-6 py-10 shadow-card-lg sm:px-12 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0 39px, rgba(32, 55, 85, 0.07) 39px 40px)",
          maskImage: "linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  </section>
);

/**
 * The white label on the notebook cover, scaled up to carry the page's headline. In the logo it
 * holds three green rules where a name would be written; here it holds the name.
 *
 * It spans its column rather than hugging its text, because on the real cover the label is a wide
 * band across the middle. A label shrink-wrapped around two words reads as a button.
 */
export const CoverLabel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "block -rotate-[1deg] rounded-2xl bg-surface px-7 py-7 shadow-card-lg sm:px-12 sm:py-10",
      className,
    )}
  >
    {children}
  </div>
);
