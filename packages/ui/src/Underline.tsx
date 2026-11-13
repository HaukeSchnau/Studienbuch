import { StyleSheet } from "react-native";

import type { Line } from "./useLastLine.ts";
import { Vector } from "./Vector.tsx";
import { Wipe } from "./Wipe.tsx";

export interface UnderlineProps {
  /** The last line of the text to underline, from `useLastLine`. */
  readonly line: Line;
  readonly color: string;
  /** Milliseconds before the pen starts. */
  readonly delay: number;
  readonly duration: number;
}

/**
 * The old web's hand-drawn swoosh under a title's last line, drawn left to right once it mounts.
 * Place it inside the view that `useLastLine` measured.
 */
export function Underline({ line, color, delay, duration }: UnderlineProps) {
  const width = Math.round(line.width);

  return (
    <Wipe
      width={width}
      height={swoosh.height}
      delay={delay}
      duration={duration}
      style={[styles.underline, { left: line.x, top: line.y + line.height - swoosh.above }]}
    >
      <Vector
        width={width}
        height={swoosh.height}
        viewBox={`0 0 ${String(width)} ${String(swoosh.height)}`}
        paths={[{ d: swoosh.path(width), stroke: color, strokeWidth: swoosh.stroke }]}
      />
    </Wipe>
  );
}

// The old web's Underline: "M2 9C54 2 128 1 298 4" in a 300 by 12 box, stretched under the words
// with a 5 px stroke. Here the curve is scaled to the line's width in pixels instead, so the stroke
// keeps its 5 px without `non-scaling-stroke`. Its start sits 2.4 px above the line's bottom edge,
// as the old web's did.
const swoosh = {
  height: 12,
  stroke: 5,
  above: 10,
  path: (width: number) => {
    const x = (value: number) => ((value / 300) * width).toFixed(1);
    const y = (value: number) => (4 + value * 0.4).toFixed(1);

    return `M${x(2)} ${y(9)}C${x(54)} ${y(2)} ${x(128)} ${y(1)} ${x(298)} ${y(4)}`;
  },
};

const styles = StyleSheet.create({ underline: { position: "absolute" } });
