import clsx from "clsx";
import { Platform, StyleSheet, View } from "react-native";
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

const minimumTouchTarget = Platform.OS === "android" ? 48 : 44;

const containerSizeMap = {
  plain: 0,
  subtle: minimumTouchTarget,
  filled: Platform.OS === "android" ? 48 : 44,
} as const;

const backgroundColorMap = {
  subtle: colors.primary.des,
  filled: colors.accent.DEFAULT,
} as const;

const { elevatedShadow } = StyleSheet.create({
  elevatedShadow: {
    shadowColor: "#203755",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
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
    variant === "plain"
      ? { minWidth: minimumTouchTarget, minHeight: minimumTouchTarget }
      : undefined,
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
