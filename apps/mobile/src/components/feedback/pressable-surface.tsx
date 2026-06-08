import clsx from "clsx";
import type { ReactNode } from "react";
import { useCallback } from "react";
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type WithTimingConfig,
} from "react-native-reanimated";

import { haptics } from "~/platform/haptics";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const pressTiming: WithTimingConfig = {
  duration: Platform.OS === "ios" ? 90 : 120,
  easing: Easing.out(Easing.quad),
};

const releaseSpring = {
  damping: 18,
  mass: 0.7,
  stiffness: 360,
};

type HapticMode = "none" | "selection" | "impact";

interface Props extends Omit<PressableProps, "children" | "style" | "onPressIn" | "onPressOut"> {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  highlightColor?: string;
  highlightOpacity?: number;
  borderRadius?: number;
  haptic?: HapticMode;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
}

export function PressableSurface({
  accessible,
  accessibilityRole = "button",
  android_ripple,
  borderRadius = 24,
  children,
  className,
  disabled,
  haptic = "selection",
  highlightColor = "rgba(9, 138, 0, 0.14)",
  highlightOpacity = Platform.OS === "ios" ? 1 : 0,
  onPress,
  onPressIn,
  onPressOut,
  pressedScale = Platform.OS === "ios" ? 0.975 : 0.992,
  style,
  ...props
}: Props) {
  const scale = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!disabled && onPress) {
        if (haptic === "selection") {
          haptics.selection();
        } else if (haptic === "impact") {
          haptics.impact();
        }
        scale.value = withTiming(pressedScale, pressTiming);
        overlayOpacity.value = withTiming(highlightOpacity, pressTiming);
      }
      onPressIn?.(event);
    },
    [disabled, haptic, highlightOpacity, onPress, onPressIn, overlayOpacity, pressedScale, scale],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      scale.value = withSpring(1, releaseSpring);
      overlayOpacity.value = withTiming(0, pressTiming);
      onPressOut?.(event);
    },
    [onPressOut, overlayOpacity, scale],
  );

  return (
    <AnimatedPressable
      {...props}
      accessible={accessible ?? Boolean(onPress)}
      accessibilityRole={onPress ? accessibilityRole : undefined}
      android_ripple={
        android_ripple ?? {
          borderless: false,
          color: "rgba(9, 138, 0, 0.16)",
          foreground: true,
        }
      }
      className={clsx("overflow-hidden", className)}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, { borderRadius }, style]}
    >
      {children}
      {highlightOpacity > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              backgroundColor: highlightColor,
              borderRadius,
              bottom: 0,
              left: 0,
              position: "absolute",
              right: 0,
              top: 0,
            },
            overlayStyle,
          ]}
        />
      ) : null}
    </AnimatedPressable>
  );
}
