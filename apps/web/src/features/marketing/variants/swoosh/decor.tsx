import type { ReactNode } from "react";

import { cn } from "#/ui/cn.ts";

/**
 * The wide-viewport reading of the app's header: a green area whose bottom edge sweeps up to the
 * right, with a blue line tracing it and overshooting past both edges.
 *
 * The proportions come from `apps/mobile/src/assets/home-bg.svg`, redrawn for a full-bleed band
 * rather than a 390pt phone. Draw it directly below a green area so the fill at the top of the
 * viewBox continues it. `preserveAspectRatio="none"` lets the curve stretch to any width, and
 * `non-scaling-stroke` keeps the blue line an even weight while it does.
 */
export const SwooshEdge = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={cn("block w-full", className)}
    preserveAspectRatio="none"
    viewBox="0 0 1440 180"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M0 0h1440v40c-268 1-497 33-737 78C471 160 243 174 0 177Z"
      fill="var(--color-primary)"
    />
    <path
      d="M-60 192C216 188 470 172 723 127 976 82 1192 50 1500 48"
      fill="none"
      stroke="var(--color-accent)"
      strokeLinecap="round"
      strokeWidth="5"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/**
 * A green panel that ends in the swoosh. Its height follows its children, so whatever comes next
 * can be pulled up with a negative margin to sit across the curve, the way cards ride over the
 * header in the native app.
 */
export const SwooshPanel = ({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) => (
  // `isolate` keeps the `-z-10` background inside this panel. Without it the negative layer drops
  // behind the page background and the green disappears.
  <div className={cn("relative isolate", className)} id={id}>
    <div className="absolute inset-0 -z-10 grid grid-rows-[1fr_auto]">
      <div className="bg-primary" />
      {/* `-mt-px` closes the hairline the browser leaves between the solid green and the stretched
          SVG when the panel's height lands on a fractional pixel. */}
      <SwooshEdge className="-mt-px h-16 sm:h-24 lg:h-32" />
    </div>
    {children}
  </div>
);

/**
 * The ruled paper from the notebook in the logo, at the faintest weight that still reads as paper.
 * Fades out at the bottom so it never collides with whatever section follows.
 */
export const RuledPaper = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cn("pointer-events-none absolute inset-0 -z-10", className)}
    style={{
      background:
        "repeating-linear-gradient(to bottom, transparent 0 39px, rgba(32, 55, 85, 0.07) 39px 40px)",
      maskImage: "linear-gradient(to bottom, transparent, black 15%, black 80%, transparent)",
    }}
  />
);

/**
 * The white label from the notebook cover in `branding/logo/app-icon.svg`, used to carry a section
 * heading. Rotated a degree and a half so it reads as something stuck on rather than laid out.
 */
export const LabelSticker = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-block -rotate-[1.5deg] rounded-xl bg-surface px-5 py-2 shadow-card-lg",
      className,
    )}
  >
    {children}
  </span>
);
