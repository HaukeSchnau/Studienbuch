import clsx from "clsx";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { colors } from "~/theme/colors";
import { SystemIcon, type SystemIconName } from "./system-icon";
import { usePressAnimation } from "../use-press-animation";
import { PressableSurface } from "../feedback/pressable-surface";

interface Props {
  icon: SystemIconName;
  color?: string;
  size?: number;
  onPress?: () => void;
  opacity?: number;
  variant?: "plain" | "subtle" | "filled";
  elevated?: boolean;
  className?: string;
  accessibilityLabel?: string;
}

const containerSizeMap = {
  plain: 0,
  subtle: 40,
  filled: 44,
} as const;

const backgroundColorMap = {
  subtle: colors.primary.des,
  filled: colors.accent.DEFAULT,
} as const;

const { elevatedShadow } = StyleSheet.create({
  elevatedShadow: {
    shadowColor: "#000",
    shadowOffset: {
      width: 8,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
});

export const IconButton = ({
  icon,
  color,
  size = 24,
  onPress,
  opacity = 1,
  variant = "plain",
  elevated = false,
  className,
  accessibilityLabel,
}: Props) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(
    variant === "plain" ? 0.92 : 0.95,
  );
  const containerSize = containerSizeMap[variant];
  const backgroundColor = variant === "plain" ? undefined : backgroundColorMap[variant];
  const hasElevatedContainer = elevated && containerSize > 0;
  const buttonClassName = clsx(
    variant === "plain" ? "p-2" : "items-center justify-center rounded-full",
    className,
  );
  const buttonStyle = [
    containerSize > 0 ? { width: containerSize, height: containerSize } : undefined,
    backgroundColor ? { backgroundColor } : undefined,
  ];

  return (
    <Animated.View
      style={[
        animatedStyle,
        hasElevatedContainer
          ? {
              width: containerSize,
              height: containerSize,
            }
          : undefined,
      ]}
    >
      {hasElevatedContainer ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            elevatedShadow,
            {
              borderRadius: containerSize / 2,
              backgroundColor,
            },
          ]}
        />
      ) : null}
      <PressableSurface
        accessibilityLabel={accessibilityLabel ?? icon}
        android_ripple={{
          borderless: variant === "plain",
          color: "rgba(0, 0, 0, 0.12)",
          radius: variant === "plain" ? 24 : containerSize / 2,
        }}
        borderRadius={variant === "plain" ? 24 : containerSize / 2}
        highlightOpacity={0}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        pressedScale={1}
        className={buttonClassName}
        style={buttonStyle}
      >
        <SystemIcon
          name={icon}
          color={color ?? (variant === "filled" ? colors.on.primary : colors.primary.text)}
          size={size}
          opacity={opacity}
        />
      </PressableSurface>
    </Animated.View>
  );
};
