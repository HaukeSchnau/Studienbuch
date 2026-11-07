import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion.ts";

// The old web uncovers a finished stroke from left to right with a clip-path wipe
// (legacy-2026-10 apps/web/src/styles.css, `draw-wipe`). A box that widens over a child of fixed
// width does the same on every platform. The swoosh and the tick both run left to right, so the
// wipe reads as the pen drawing them. Wipe.web.tsx is the same in CSS.
const uncover = { from: { width: "0%" }, to: { width: "100%" } } as const;

export interface WipeProps {
  /** The drawing's own size, which stays put while the box over it widens. */
  readonly width: number;
  readonly height: number;
  readonly delay: number;
  readonly duration: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

/** Draws its child from left to right once, when it mounts. With reduced motion it is just there. */
export function Wipe({ width, height, delay, duration, style, children }: WipeProps) {
  const still = useReducedMotion();

  return (
    <View aria-hidden pointerEvents="none" style={[{ width, height }, style]}>
      <Animated.View
        style={[
          styles.clip,
          still
            ? null
            : {
                animationName: uncover,
                animationDuration: duration,
                animationDelay: delay,
                animationTimingFunction: cubicBezier(0.65, 0, 0.35, 1),
                animationFillMode: "both",
              },
        ]}
      >
        <View style={{ width, height }}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { height: "100%", width: "100%", overflow: "hidden" },
});
