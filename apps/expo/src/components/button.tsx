import type { ComponentRef } from "react";
import { forwardRef } from "react";
import { TouchableOpacity } from "react-native";
import clsx from "clsx";

import { colors } from "@stu/tailwind-config/native";

import { shadow } from "./styles/shadow";
import { Text } from "./text";

interface Props {
  label: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  color?: string;
}

export const Button = forwardRef<ComponentRef<typeof TouchableOpacity>, Props>(
  ({ className, disabled, onPress, label }, ref) => {
    return (
      <TouchableOpacity
        className={clsx(
          "rounded-3xl px-6 py-3",
          disabled ? "bg-neutral" : "bg-accent",
          className,
        )}
        style={shadow}
        onPress={onPress}
        ref={ref}
      >
        <Text className="w-fit text-center text-lg text-white" weight="bold">
          {label}
        </Text>
      </TouchableOpacity>
    );
  },
);

export const OutlinedButton = forwardRef<
  ComponentRef<typeof TouchableOpacity>,
  Props
>(({ className, onPress, label, color = colors.danger.DEFAULT }, ref) => {
  return (
    <TouchableOpacity
      className={clsx("rounded-3xl border px-5 py-2", className)}
      style={[
        shadow,
        {
          borderColor: color,
        },
      ]}
      onPress={onPress}
      ref={ref}
    >
      <Text
        className="w-fit text-center text-lg"
        weight="bold"
        style={{ color }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

export const TextButton = forwardRef<
  ComponentRef<typeof TouchableOpacity>,
  Props
>(({ className, onPress, label }, ref) => {
  return (
    <TouchableOpacity
      className={clsx("px-2 py-1", className)}
      onPress={onPress}
      ref={ref}
    >
      <Text className="text-lg text-accent" weight="bold">
        {label}
      </Text>
    </TouchableOpacity>
  );
});
