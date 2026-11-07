import { StyleSheet, View } from "react-native";

import { Arrive } from "./Arrive.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { useLastLine } from "./useLastLine.ts";
import { Vector } from "./Vector.tsx";
import { Wipe } from "./Wipe.tsx";

export interface AuthHeadingProps {
  /** One short title per step, such as "Willkommen!" or "Konto erstellen". */
  readonly children: string;
}

/**
 * A step's title, centred in the accent green, with the blue swoosh under it that draws itself
 * once the words have arrived (the old web's AuthHeading). A title that wraps has the swoosh under
 * its last line. A new title draws it again.
 */
export function AuthHeading({ children }: AuthHeadingProps) {
  const { color } = Theme.useTheme();
  const words = useLastLine();

  return (
    <Arrive key={children} duration={720} style={styles.heading}>
      <View {...words.container}>
        <Text
          {...words.text}
          variant="title1"
          accessibilityRole="header"
          style={[styles.title, { color: color.accent }]}
        >
          {children}
        </Text>
      </View>
      {words.line === undefined ? null : (
        <Wipe
          width={Math.round(words.line.width)}
          height={swoosh.height}
          delay={640}
          duration={560}
          style={[
            styles.underline,
            { left: words.line.x, top: words.line.y + words.line.height - swoosh.above },
          ]}
        >
          <Vector
            width={Math.round(words.line.width)}
            height={swoosh.height}
            viewBox={`0 0 ${String(Math.round(words.line.width))} ${String(swoosh.height)}`}
            paths={[
              {
                d: swoosh.path(Math.round(words.line.width)),
                stroke: color.heroEdge,
                strokeWidth: swoosh.stroke,
              },
            ]}
          />
        </Wipe>
      )}
    </Arrive>
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

const styles = StyleSheet.create({
  // A title may reach 8 points into the card's padding, so "Passwort vergessen?" stays on one
  // line at 390 points, as on the old web.
  heading: { alignSelf: "center", marginHorizontal: -8 },
  // The old web's text-3xl, Nunito Bold.
  title: { fontSize: 30, lineHeight: 36, fontWeight: "700", textAlign: "center" },
  underline: { position: "absolute" },
});
