import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

import { shadow } from "../styles/shadow";
import { usePressAnimation } from "../use-press-animation";

const cardPaddingMap = {
  none: 0,
  sm: 16,
  md: 24,
} as const;

const cardRadiusMap = {
  sm: 24,
  md: 28,
  lg: 36,
} as const;

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const Card = ({
  children,
  className,
  style,
  onPress,
  noShadow,
  padding = "md",
  radius = "lg",
  backgroundColor = "white",
}: {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  noShadow?: boolean;
  padding?: keyof typeof cardPaddingMap;
  radius?: keyof typeof cardRadiusMap;
  backgroundColor?: string;
}) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.985);
  const contentStyle = [
    {
      backgroundColor,
      borderRadius: cardRadiusMap[radius],
      padding: cardPaddingMap[padding],
    },
  ];
  const containerStyle = [noShadow ? undefined : shadow, style];

  if (onPress) {
    return (
      <AnimatedTouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[animatedStyle, contentStyle, containerStyle]}
        className={className}
        activeOpacity={1}
      >
        {children}
      </AnimatedTouchableOpacity>
    );
  }

  return (
    <View style={[contentStyle, containerStyle]} className={className}>
      {children}
    </View>
  );
};
