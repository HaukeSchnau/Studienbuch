import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "#/ui/cn.ts";
import { useFinePointer, useMotionAllowed } from "#/ui/use-motion.ts";

/**
 * Leans its children a few degrees towards the pointer.
 *
 * This is the one effect that responds to the visitor rather than to the page, and it is what makes
 * a screen feel attended-to rather than played back. The rotation is deliberately small: past about
 * four degrees it stops reading as a lean and starts reading as a toy.
 *
 * Pointer position is written straight to CSS custom properties inside a rAF callback, so a burst
 * of `pointermove` events collapses into at most one style write per frame and React never
 * re-renders. Listening on the window rather than the element means the lean follows the pointer
 * across the whole hero instead of only while it is directly over the render.
 */
export const PointerTilt = ({
  children,
  className,
  strength = 3.5,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum degrees of rotation at the far edge of the viewport. */
  strength?: number;
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
      // Normalised to -1..1 from the centre of the viewport.
      const x = (pending.x / globalThis.innerWidth) * 2 - 1;
      const y = (pending.y / globalThis.innerHeight) * 2 - 1;
      element.style.setProperty("--tilt-x", `${(-y * strength).toFixed(2)}deg`);
      element.style.setProperty("--tilt-y", `${(x * strength).toFixed(2)}deg`);
      pending = undefined;
    };

    const onMove = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY };
      frame ||= globalThis.requestAnimationFrame(apply);
    };

    globalThis.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      globalThis.removeEventListener("pointermove", onMove);
      if (frame !== 0) {
        globalThis.cancelAnimationFrame(frame);
      }
      element.style.removeProperty("--tilt-x");
      element.style.removeProperty("--tilt-y");
    };
  }, [active, strength]);

  return (
    <div className={cn(active && "pointer-tilt", className)} ref={host}>
      {children}
    </div>
  );
};
