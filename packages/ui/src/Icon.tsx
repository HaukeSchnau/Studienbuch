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
