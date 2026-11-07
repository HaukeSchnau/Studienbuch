import { StyleSheet, View } from "react-native";

import type { GrowProps } from "./Grow.tsx";
import { useLayout } from "./useLayout.ts";
import { useReducedMotion } from "./useReducedMotion.ts";

/** Grow.tsx on the web, as a CSS transition through React Native for the web. */
export function Grow({ style, children }: GrowProps) {
  const still = useReducedMotion();
  const content = useLayout();

  return (
    <View
      style={[
        style,
        styles.clip,
        content.layout === undefined ? null : { height: Math.ceil(content.layout.height) },
        still ? null : styles.transition,
      ]}
    >
      <View onLayout={content.onLayout}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  transition: {
    transitionProperty: "height",
    transitionDuration: "300ms",
    transitionTimingFunction: "ease-in-out",
  },
});
