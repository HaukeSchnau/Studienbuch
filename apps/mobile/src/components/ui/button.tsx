import { colors } from "~/theme/colors";
import clsx from "clsx";
import type { ComponentRef } from "react";
import { forwardRef } from "react";
import { TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { shadow } from "../styles/shadow";
import { Text } from "./text";
import { usePressAnimation } from "../use-press-animation";

interface Props {
  label: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  color?: string;
  size?: "sm" | "md";
}

const sizeClassNameMap = {
  sm: "min-h-11 px-5 py-2",
  md: "min-h-12 px-6 py-3",
} as const;

const textSizeClassNameMap = {
  sm: "text-base",
  md: "text-lg",
} as const;

const BaseButton = forwardRef<
  ComponentRef<typeof TouchableOpacity>,
  Props & {
    textColor: string;
    backgroundColor?: string;
    borderColor?: string;
    elevated?: boolean;
    rounded?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>(
  (
    {
      className,
      disabled,
      onPress,
      label,
      size = "md",
      textColor,
      backgroundColor,
      borderColor,
      elevated = false,
      rounded = true,
      style,
    },
    ref,
  ) => {
    const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(rounded ? 0.97 : 0.98);

    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          className={clsx(
            rounded ? "rounded-full" : null,
            "items-center justify-center",
            sizeClassNameMap[size],
            className,
          )}
          style={[
            elevated ? shadow : undefined,
            backgroundColor ? { backgroundColor } : undefined,
            borderColor ? { borderWidth: 1, borderColor } : undefined,
            style,
          ]}
          onPress={onPress}
          onPressIn={disabled ? undefined : onPressIn}
          onPressOut={disabled ? undefined : onPressOut}
          disabled={disabled}
          activeOpacity={1}
          ref={ref}
        >
          <Text
            className={clsx("w-fit text-center", textSizeClassNameMap[size])}
            weight="bold"
            style={{ color: textColor }}
          >
            {label}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

export const Button = forwardRef<ComponentRef<typeof TouchableOpacity>, Props>(
  ({ className, disabled, onPress, label, size }, ref) => {
    return (
      <BaseButton
        className={className}
        disabled={disabled}
        onPress={onPress}
        label={label}
        size={size}
        elevated
        backgroundColor={disabled ? colors.neutral.DEFAULT : colors.accent.DEFAULT}
        textColor={colors.on.primary}
        ref={ref}
      />
    );
  },
);

export const OutlinedButton = forwardRef<ComponentRef<typeof TouchableOpacity>, Props>(
  ({ className, onPress, label, color = colors.danger.DEFAULT, size = "md" }, ref) => {
    return (
      <BaseButton
        className={className}
        onPress={onPress}
        label={label}
        size={size}
        elevated
        backgroundColor={colors.surface}
        borderColor={color}
        textColor={color}
        ref={ref}
      />
    );
  },
);

export const TextButton = forwardRef<ComponentRef<typeof TouchableOpacity>, Props>(
  ({ className, onPress, label, size = "md", color = colors.accent.DEFAULT }, ref) => {
    return (
      <BaseButton
        className={clsx("min-h-11 px-2 py-1", className)}
        onPress={onPress}
        label={label}
        size={size}
        textColor={color}
        rounded={false}
        ref={ref}
      />
    );
  },
);
