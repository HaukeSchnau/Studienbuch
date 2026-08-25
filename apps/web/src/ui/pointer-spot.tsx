import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "#/ui/cn.ts";
import { useFinePointer, useMotionAllowed } from "#/ui/use-motion.ts";

/**
 * Tracks the pointer across its own box and exposes the position as CSS custom properties, so a
 * soft light can follow the cursor over a coloured panel.
 *
 * Position is element-relative rather than viewport-relative, because the light belongs to the
 * panel: it should sit where the pointer is over *it*, not where the pointer is on the page.
 *
 * Writes happen inside a rAF callback, so a burst of `pointermove` collapses to one style write per
 * frame and React never re-renders. The light only fades in once the pointer has actually arrived,
 * so a panel nobody has touched has no highlight sitting in its middle.
 */
export const PointerSpot = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const host = useRef<HTMLDivElement>(null);
  const motionAllowed = useMotionAllowed();
  const finePointer = useFinePointer();
  const active = motionAllowed && finePointer;

  useEffect(() => {
    const element = host.current;
    if (element === null || !active) {
      return;
    }

    let frame = 0;
    let pending: { x: number; y: number } | undefined;

    const apply = () => {
      frame = 0;
      if (pending === undefined) {
        return;
      }
      const box = element.getBoundingClientRect();
      element.style.setProperty(
        "--spot-x",
        `${(((pending.x - box.left) / box.width) * 100).toFixed(1)}%`,
      );
      element.style.setProperty(
        "--spot-y",
        `${(((pending.y - box.top) / box.height) * 100).toFixed(1)}%`,
      );
      element.style.setProperty("--spot-on", "1");
      pending = undefined;
    };

    const onMove = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      frame ||= globalThis.requestAnimationFrame(apply);
    };
    const onLeave = () => {
      element.style.setProperty("--spot-on", "0");
    };

    element.addEventListener("pointermove", onMove, { passive: true });
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      if (frame !== 0) {
        globalThis.cancelAnimationFrame(frame);
      }
      element.style.removeProperty("--spot-on");
    };
  }, [active]);

  return (
    <div className={cn(active && "spotlight", className)} ref={host}>
      {children}
    </div>
  );
};
