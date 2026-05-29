import Icon from "@expo/vector-icons/MaterialIcons";
import clsx from "clsx";
import type { ComponentProps, ComponentRef } from "react";
import { forwardRef } from "react";
import { TouchableOpacity } from "react-native";
import { colors } from "~/theme/colors";
import { shadow } from "./styles/shadow";

interface Props {
  icon: ComponentProps<typeof Icon>["name"];
  color?: ComponentProps<typeof Icon>["color"];
  size?: ComponentProps<typeof Icon>["size"];
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
    const containerSize = containerSizeMap[variant];
    const backgroundColor = variant === "plain" ? undefined : backgroundColorMap[variant];

    return (
      <TouchableOpacity
        onPress={onPress}
        ref={ref}
        activeOpacity={0.85}
        className={clsx(
          variant === "plain" ? "p-1" : "items-center justify-center rounded-full",
          className,
        )}
        style={[
          containerSize > 0 ? { width: containerSize, height: containerSize } : undefined,
          backgroundColor ? { backgroundColor } : undefined,
          elevated ? shadow : undefined,
        ]}
      >
        <Icon
          name={icon}
          color={color ?? (variant === "filled" ? colors.on.primary : colors.primary.text)}
          size={size}
          style={{ opacity }}
        />
      </TouchableOpacity>
    );
  },
);
