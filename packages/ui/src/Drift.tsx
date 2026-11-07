import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { type CSSAnimationKeyframes } from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion.ts";

// The blobs' two slow motions, transforms only so they stay off the main thread. `drift` is the
// old web's (legacy-2026-10 apps/web/src/styles.css). `breathe` stands in for its path morph,
// which took about 14 % of a core on an idle page: the outline stretches and leans a little
// instead. Drift.web.tsx is the same in CSS.
const motions: Record<DriftProps["motion"], CSSAnimationKeyframes<ViewStyle>> = {
  drift: {
    from: { transform: [{ translateY: 12 }, { rotate: "1.5deg" }, { scale: 0.98 }] },
    to: { transform: [{ translateY: -40 }, { rotate: "-3deg" }, { scale: 1.03 }] },
  },
  breathe: {
    from: { transform: [{ scaleX: 1 }, { scaleY: 1 }, { skewY: "0deg" }] },
    to: { transform: [{ scaleX: 1.05 }, { scaleY: 0.96 }, { skewY: "-2deg" }] },
  },
};

export interface DriftProps {
  readonly motion: "drift" | "breathe";
  /** Seconds there and back. Two blobs with different ones never move in unison. */
  readonly seconds: number;
  /** Where in the cycle it starts, from 0 to 1. */
  readonly offset?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

/** Moves its children back and forth for as long as it shows. With reduced motion they stay put. */
export function Drift({ motion, seconds, offset = 0, style, children }: DriftProps) {
  const still = useReducedMotion();

  return (
    <Animated.View
      style={[
        style,
        still
          ? null
          : {
              animationName: motions[motion],
              animationDuration: (seconds * 1000) / 2,
              animationDelay: -seconds * offset * 1000,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              animationDirection: "alternate",
            },
      ]}
    >
      {children}
    </Animated.View>
  );
}
