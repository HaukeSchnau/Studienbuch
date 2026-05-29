import { colors } from "~/theme/colors";
import clsx from "clsx";
import type { ComponentRef } from "react";
import { forwardRef } from "react";
import { TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";

import { shadow } from "./styles/shadow";
import { Text } from "./text";

interface Props {
  label: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  color?: string;
  size?: "sm" | "md";
}

const sizeClassNameMap = {
  sm: "px-5 py-2",
  md: "px-6 py-3",
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
    return (
      <TouchableOpacity
        className={clsx(rounded ? "rounded-full" : null, sizeClassNameMap[size], className)}
        style={[
          elevated ? shadow : undefined,
          backgroundColor ? { backgroundColor } : undefined,
          borderColor ? { borderWidth: 1, borderColor } : undefined,
          style,
        ]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.85}
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
        className={clsx("px-2 py-1", className)}
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
