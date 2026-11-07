import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useLayout } from "./useLayout.ts";
import { useReducedMotion } from "./useReducedMotion.ts";

export interface GrowProps {
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

/**
 * A box that follows its content's height in 300 ms, as the Flutter app's AnimatedSize did, and
 * clips the content while it catches up. Grow.web.tsx is the same as a CSS transition.
 */
export function Grow({ style, children }: GrowProps) {
  const still = useReducedMotion();
  const content = useLayout();

  return (
    <Animated.View
      style={[
        style,
        styles.clip,
        content.layout === undefined ? null : { height: Math.ceil(content.layout.height) },
        still
          ? null
          : {
              transitionProperty: "height",
              transitionDuration: 300,
              transitionTimingFunction: "ease-in-out",
            },
      ]}
    >
      <View onLayout={content.onLayout}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ clip: { overflow: "hidden" } });
