import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { PressableSurface } from "./feedback/pressable-surface";
import { shadow } from "./styles/shadow";

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
      <PressableSurface
        accessibilityRole="button"
        borderRadius={cardRadiusMap[radius]}
        className={className}
        onPress={onPress}
        pressedScale={0.985}
        style={[contentStyle, containerStyle]}
      >
        {children}
      </PressableSurface>
    );
  }

  return (
    <View style={[contentStyle, containerStyle]} className={className}>
      {children}
    </View>
  );
};
