import type { ComponentRef } from "react";
import { forwardRef } from "react";
import { TouchableOpacity } from "react-native";
import clsx from "clsx";

import { shadow } from "./styles/shadow";
import { Text } from "./text";

interface Props {
  label: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
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
>(({ className, onPress, label }, ref) => {
  return (
    <TouchableOpacity
      className={clsx(
        "rounded-3xl px-5 py-2",
        "border border-danger",
        className,
      )}
      style={shadow}
      onPress={onPress}
      ref={ref}
    >
      <Text className="w-fit text-center text-lg text-danger" weight="bold">
        {label}
      </Text>
    </TouchableOpacity>
  );
});
