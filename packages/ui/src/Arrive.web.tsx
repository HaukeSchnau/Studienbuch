import { StyleSheet, View } from "react-native";

import type { ArriveProps } from "./Arrive.tsx";
import { useReducedMotion } from "./useReducedMotion.ts";

declare module "react-native" {
  // React Native for the web's CSS animation and transition props, which the `.web.tsx` motion
  // pieces use. Keyframes take CSS values, transforms as strings.
  interface ViewStyle {
    readonly animationKeyframes?: ReadonlyArray<
      Readonly<Record<string, Readonly<Record<string, string | number>>>>
    >;
    readonly animationDuration?: string;
    readonly animationDelay?: string;
    readonly animationTimingFunction?: string;
    readonly animationFillMode?: "none" | "forwards" | "backwards" | "both";
    readonly animationIterationCount?: number | "infinite";
    readonly animationDirection?: "normal" | "reverse" | "alternate" | "alternate-reverse";
    readonly transitionProperty?: string;
    readonly transitionDuration?: string;
    readonly transitionTimingFunction?: string;
  }
}

/**
 * Arrive.tsx on the web, as a CSS animation through React Native for the web, so the web loads no
 * Reanimated. React Native for the web compiles keyframes only from a style sheet.
 */
export function Arrive({
  from = "below",
  delay = 0,
  duration = 620,
  style,
  children,
}: ArriveProps) {
  const still = useReducedMotion();

  return (
    <View
      style={[
        style,
        still
          ? null
          : [
              entrances[from],
              { animationDuration: `${String(duration)}ms`, animationDelay: `${String(delay)}ms` },
            ],
      ]}
    >
      {children}
    </View>
  );
}

const entrances = StyleSheet.create({
  below: {
    animationKeyframes: [
      {
        from: { opacity: 0, transform: "translateY(56px)" },
        to: { opacity: 1, transform: "translateY(0)" },
      },
    ],
    animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.3, 1)",
    animationFillMode: "both",
  },
  above: {
    animationKeyframes: [
      {
        from: { opacity: 0, transform: "translateY(-6px)" },
        to: { opacity: 1, transform: "translateY(0)" },
      },
    ],
    animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.3, 1)",
    animationFillMode: "both",
  },
});
