import { Vector, type VectorPath } from "./Vector.tsx";

// The few glyphs our own content draws, on a 24-point grid. Chrome uses the platform's symbols.
const stroked =
  (d: string) =>
  (color: string): ReadonlyArray<VectorPath> => [{ d, stroke: color, strokeWidth: 2.4 }];

const glyphs = {
  check: stroked("M5 12.5l4.5 4.5L19 7.5"),
  chevron: stroked("M9.5 6l6 6-6 6"),
  back: stroked("M14.5 6l-6 6 6 6"),
  plus: stroked("M12 5v14M5 12h14"),
  alert: stroked("M12 7.5v6M12 17v.01"),
  alertCircle: stroked("M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7.5v5M12 16.25v.01"),
  /** A bin, for deleting. */
  delete: stroked("M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"),
  clock: stroked("M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7.5V12l3 2"),
  /** Waiting to go out. */
  cloudUp: stroked(
    "M7 19h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.1 10.6 4.25 4.25 0 0 0 7 19zM12 16v-5.5M9.75 12.75 12 10.5l2.25 2.25",
  ),
  cloudOff: stroked(
    "M7 19h10a4 4 0 0 0 .7-7.94A6 6 0 0 0 6.1 10.6 4.25 4.25 0 0 0 7 19zM4 4l16 16",
  ),
  lock: stroked(
    "M8 11V8a4 4 0 0 1 8 0v3M6.5 11h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z",
  ),
  /** A person with a key. */
  passkey: stroked(
    "M6 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M3 19.5c.6-3 2.9-5 6.5-5 1.2 0 2.3.2 3.2.6M15.5 13a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17.5 15v5.5M17.5 18h1.75M17.5 20.25h1.25",
  ),
  retry: stroked("M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5V9H15"),
  /** Confirmed: a white tick in a filled circle. */
  checkBadge: (color: string): ReadonlyArray<VectorPath> => [
    { d: "M0 12a12 12 0 1 0 24 0a12 12 0 1 0-24 0", fill: color },
    { d: "M7 12.5l3.2 3.2L17 9", stroke: "#FFFFFF", strokeWidth: 2.8 },
  ],
  /** Still missing: an open ring. */
  openBadge: (color: string): ReadonlyArray<VectorPath> => [
    { d: "M2.5 12a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0-19 0", stroke: color, strokeWidth: 2.6 },
  ],
};

export type IconName = keyof typeof glyphs;

export interface IconProps {
  readonly name: IconName;
  readonly color: string;
  readonly size?: number;
}

export function Icon({ name, color, size = 24 }: IconProps) {
  return <Vector width={size} height={size} viewBox="0 0 24 24" paths={glyphs[name](color)} />;
}
