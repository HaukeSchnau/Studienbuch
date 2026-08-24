import type { ReactNode } from "react";

import { cn } from "#/ui/cn.ts";

/**
 * The green band with a blue line trailing out of it is Studienbuch's one load-bearing shape: it
 * caps every screen of the native app (`apps/mobile/src/assets/images/home-bg.svg`). This is the
 * wide-viewport reading of it — the same sweep and the same overshooting blue stroke, redrawn for
 * a full-bleed band instead of a 430pt phone.
 *
 * Draw it directly below a green area so the fill at the top of the viewBox continues it.
 * `preserveAspectRatio="none"` lets the curve stretch to any width, and `non-scaling-stroke` keeps
 * the blue line an even weight while it does.
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
      d="M0 0h1440v42c-262 2-486 34-724 78C489 158 246 172 0 175Z"
      fill="var(--color-primary)"
    />
    <path
      d="M-60 190C214 186 466 170 716 126 966 82 1188 52 1500 50"
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
 * can be pulled up with a negative margin to sit across the curve — the overlap the native app
 * gets from cards riding over its header.
 */
export const SwooshPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  // `isolate` keeps the `-z-10` background inside this panel; without it the negative layer drops
  // behind the page background and the green disappears.
  <div className={cn("relative isolate", className)}>
    <div className="absolute inset-0 -z-10 grid grid-rows-[1fr_auto]">
      <div className="bg-primary" />
      {/* `-mt-px` closes the hairline the browser leaves between the solid green and the stretched
          SVG when the panel's height lands on a fractional pixel. */}
      <SwooshEdge className="-mt-px h-16 drop-shadow-[0_7px_10px_rgba(0,0,0,0.16)] sm:h-24 lg:h-32" />
    </div>
    {children}
  </div>
);
