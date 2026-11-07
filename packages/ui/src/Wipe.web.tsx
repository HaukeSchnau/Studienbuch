import { StyleSheet, View } from "react-native";

import { useReducedMotion } from "./useReducedMotion.ts";
import type { WipeProps } from "./Wipe.tsx";

/** Wipe.tsx on the web, as a CSS animation through React Native for the web. */
export function Wipe({ width, height, delay, duration, style, children }: WipeProps) {
  const still = useReducedMotion();

  return (
    <View aria-hidden pointerEvents="none" style={[{ width, height }, style]}>
      <View
        style={[
          styles.clip,
          still
            ? null
            : [
                styles.uncover,
                {
                  animationDuration: `${String(duration)}ms`,
                  animationDelay: `${String(delay)}ms`,
                },
              ],
        ]}
      >
        <View style={{ width, height }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { height: "100%", width: "100%", overflow: "hidden" },
  uncover: {
    animationKeyframes: [{ from: { width: "0%" }, to: { width: "100%" } }],
    animationTimingFunction: "cubic-bezier(0.65, 0, 0.35, 1)",
    animationFillMode: "both",
  },
});
