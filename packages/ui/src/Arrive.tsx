import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";

import { useReducedMotion } from "./useReducedMotion.ts";

// The old web's entrances (legacy-2026-10 apps/web/src/styles.css): `reveal`, up from 3.5rem below
// while it fades in, and `error-in`, down from just above. Arrive.web.tsx is the same in CSS.
const entrances = {
  below: {
    from: { opacity: 0, transform: [{ translateY: 56 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
  above: {
    from: { opacity: 0, transform: [{ translateY: -6 }] },
    to: { opacity: 1, transform: [{ translateY: 0 }] },
  },
};

export interface ArriveProps {
  /** "below" for a screen's parts, "above" for an error that drops in over the button that failed. */
  readonly from?: "below" | "above";
  /** Milliseconds before it starts: 0 for the logo, 110 for the card, 220 for what follows. */
  readonly delay?: number;
  /** 620 milliseconds for a screen's parts, 480 for a confirmation, 320 for an error. */
  readonly duration?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

/**
 * Its children arrive once, when it mounts, on the old web's settling curve. A new `key` plays it
 * again. With reduced motion they are simply there.
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
    <Animated.View
      style={[
        style,
        still
          ? null
          : {
              animationName: entrances[from],
              animationDuration: duration,
              animationDelay: delay,
              animationTimingFunction: cubicBezier(0.2, 0.8, 0.3, 1),
              animationFillMode: "both",
            },
      ]}
    >
      {children}
    </Animated.View>
  );
}
