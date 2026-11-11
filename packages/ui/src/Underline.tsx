import { StyleSheet } from "react-native";

import type { Line } from "./useLastLine.ts";
import { Vector } from "./Vector.tsx";
import { Wipe } from "./Wipe.tsx";

export interface UnderlineProps {
  /** The line of text it runs under, from `useLastLine`, inside the view it is measured in. */
  readonly line: Line;
  readonly color: string;
  /** Milliseconds before the pen starts, once the words have arrived. */
  readonly delay?: number;
}

/**
 * The hand-drawn stroke under a heading, which draws itself once from left to right (the old
 * web's Underline). Place it in the view `useLastLine` measures the text in.
 */
export function Underline({ line, color, delay = 640 }: UnderlineProps) {
  const width = Math.round(line.width);

  return (
    <Wipe
      width={width}
      height={pen.height}
      delay={delay}
      duration={560}
      style={[styles.underline, { left: line.x, top: line.y + line.height - pen.above }]}
    >
      <Vector
        width={width}
        height={pen.height}
        viewBox={`0 0 ${String(width)} ${String(pen.height)}`}
        paths={[{ d: pen.path(width), stroke: color, strokeWidth: pen.stroke }]}
      />
    </Wipe>
  );
}

// The old web's Underline: "M2 9C54 2 128 1 298 4" in a 300 by 12 box, stretched under the words
// with a 5 px stroke. Here the curve is scaled to the line's width in pixels instead, so the stroke
// keeps its 5 px without `non-scaling-stroke`. Its start sits 2.4 px above the line's bottom edge,
// as the old web's did.
const pen = {
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
