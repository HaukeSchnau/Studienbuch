import { useEffect, useRef, type ReactNode, type RefObject } from "react";

import { Motion } from "./Motion.ts";

const properties = ["--pointer-x", "--pointer-y", "--spot-x", "--spot-y", "--spot-on"];

/**
 * Writes the pointer onto `element` as `--pointer-x`/`-y` (-1 to 1 across the viewport) and
 * `--spot-x`/`-y`/`-on` (relative to the element), at most once a frame and without re-rendering.
 * Returns whether it tracks: only for a fine pointer when motion is welcome.
 */
export function usePointerTracking(element: RefObject<HTMLElement | null>) {
  const motion = Motion.useAllowed();
  const finePointer = Motion.useFinePointer();
  const active = motion && finePointer;

  useEffect(() => {
    const target = element.current;

    if (target === null || !active) return;

    let frame = 0;
    let pointer: { x: number; y: number } | undefined;

    const apply = () => {
      frame = 0;

      if (pointer === undefined) return;

      const box = target.getBoundingClientRect();

      const inside =
        pointer.x >= box.left &&
        pointer.x <= box.right &&
        pointer.y >= box.top &&
        pointer.y <= box.bottom;

      target.style.setProperty("--pointer-x", ((pointer.x / innerWidth) * 2 - 1).toFixed(3));
      target.style.setProperty("--pointer-y", ((pointer.y / innerHeight) * 2 - 1).toFixed(3));
      target.style.setProperty("--spot-x", `${(pointer.x - box.left).toFixed(0)}px`);
      target.style.setProperty("--spot-y", `${(pointer.y - box.top).toFixed(0)}px`);
      target.style.setProperty("--spot-on", inside ? "1" : "0");
    };

    const onMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };

      if (frame === 0) frame = requestAnimationFrame(apply);
    };

    addEventListener("pointermove", onMove, { passive: true });

    return () => {
      removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);

      for (const property of properties) target.style.removeProperty(property);
    };
  }, [element, active]);

  return active;
}

/**
 * A box whose children can lean towards the pointer and carry a light that follows it, through the
 * `[data-pointer]` rules in the stylesheets.
 */
export function PointerTracker({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const active = usePointerTracking(host);

  return (
    <div className={className} data-pointer={active ? "fine" : undefined} ref={host}>
      {children}
    </div>
  );
}
