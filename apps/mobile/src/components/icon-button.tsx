import clsx from "clsx";
import type { ComponentRef } from "react";
import { forwardRef } from "react";
import { TouchableOpacity } from "react-native";
import Animated from "react-native-reanimated";
import { colors } from "~/theme/colors";
import { shadow } from "./styles/shadow";
import { SystemIcon, type SystemIconName } from "./system-icon";
import { usePressAnimation } from "./use-press-animation";

interface Props {
  icon: SystemIconName;
  color?: string;
  size?: number;
  onPress?: () => void;
  opacity?: number;
  variant?: "plain" | "subtle" | "filled";
  elevated?: boolean;
  className?: string;
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

export const IconButton = forwardRef<ComponentRef<typeof TouchableOpacity>, Props>(
  (
    {
      icon,
      color,
      size = 24,
      onPress,
      opacity = 1,
      variant = "plain",
      elevated = false,
      className,
    },
    ref,
  ) => {
    const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(
      variant === "plain" ? 0.92 : 0.95,
    );
    const containerSize = containerSizeMap[variant];
    const backgroundColor = variant === "plain" ? undefined : backgroundColorMap[variant];

    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          ref={ref}
          activeOpacity={1}
          className={clsx(
            variant === "plain" ? "p-2" : "items-center justify-center rounded-full",
            className,
          )}
          style={[
            containerSize > 0 ? { width: containerSize, height: containerSize } : undefined,
            backgroundColor ? { backgroundColor } : undefined,
            elevated ? shadow : undefined,
          ]}
        >
          <SystemIcon
            name={icon}
            color={color ?? (variant === "filled" ? colors.on.primary : colors.primary.text)}
            size={size}
            opacity={opacity}
          />
        </TouchableOpacity>
      </Animated.View>
    );
  },
);
