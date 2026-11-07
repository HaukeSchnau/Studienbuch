import { StyleSheet, View } from "react-native";

import type { DriftProps } from "./Drift.tsx";
import { useReducedMotion } from "./useReducedMotion.ts";

/** Drift.tsx on the web, as a CSS animation through React Native for the web. */
export function Drift({ motion, seconds, offset = 0, style, children }: DriftProps) {
  const still = useReducedMotion();

  return (
    <View
      style={[
        style,
        still
          ? null
          : [
              motions[motion],
              {
                animationDuration: `${String((seconds * 1000) / 2)}ms`,
                animationDelay: `${String(-seconds * offset * 1000)}ms`,
              },
            ],
      ]}
    >
      {children}
    </View>
  );
}

const loop = {
  animationTimingFunction: "ease-in-out",
  animationIterationCount: "infinite",
  animationDirection: "alternate",
} as const;

const motions = StyleSheet.create({
  drift: {
    ...loop,
    animationKeyframes: [
      {
        from: { transform: "translateY(12px) rotate(1.5deg) scale(0.98)" },
        to: { transform: "translateY(-40px) rotate(-3deg) scale(1.03)" },
      },
    ],
  },
  breathe: {
    ...loop,
    animationKeyframes: [
      {
        from: { transform: "scaleX(1) scaleY(1) skewY(0deg)" },
        to: { transform: "scaleX(1.05) scaleY(0.96) skewY(-2deg)" },
      },
    ],
  },
});
