import { View } from "react-native";

import { Theme } from "./Theme.ts";
import { Vector } from "./Vector.tsx";
import { Wipe } from "./Wipe.tsx";

export interface SuccessTickProps {
  /** 48 above a confirmation's title, 24 inside a field whose value is complete. */
  readonly size?: number;
  /** Milliseconds before the pen starts. */
  readonly delay?: number;
  /** What the tick says to a screen reader, such as "Code vollständig". Without one it is silent. */
  readonly label?: string;
}

/**
 * The tick the old web drew when something landed ("Schau in dein Postfach"): one stroke in the
 * accent green that draws itself once.
 */
export function SuccessTick({ size = 48, delay = 180, label }: SuccessTickProps) {
  const { color } = Theme.useTheme();

  const tick = (
    <Wipe width={size} height={size} delay={delay} duration={520}>
      <Vector
        width={size}
        height={size}
        viewBox="0 0 32 32"
        paths={[{ d: "M6 17l6.5 6.5L26 10", stroke: color.accent, strokeWidth: 3.5 }]}
      />
    </Wipe>
  );

  return label === undefined ? (
    tick
  ) : (
    <View accessibilityRole="image" accessibilityLabel={label}>
      {tick}
    </View>
  );
}
