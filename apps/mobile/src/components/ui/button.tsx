import { Button as ExpoButton, Host } from "@expo/ui";
import { tint } from "@expo/ui/swift-ui/modifiers";
import clsx from "clsx";
import { Platform, View } from "react-native";

import { haptics } from "~/platform/haptics";
import { colors } from "~/theme/colors";

interface Props {
  label: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  color?: string;
  size?: "sm" | "md";
}

const baseButtonStyle = {
  sm: { height: 44 },
  md: { height: 48 },
} as const;

function BaseButton({
  className,
  disabled,
  onPress,
  label,
  size = "md",
  variant,
  tintColor,
}: Props & {
  variant: "filled" | "outlined" | "text";
  tintColor?: string;
}) {
  const modifiers = Platform.OS === "ios" && tintColor ? [tint(tintColor)] : undefined;

  return (
    <View className={clsx("items-center justify-center", className)}>
      <Host matchContents>
        <ExpoButton
          disabled={disabled}
          label={label}
          onPress={() => {
            haptics.selection();
            onPress?.();
          }}
          style={{
            ...baseButtonStyle[size],
          }}
          modifiers={modifiers}
          variant={variant}
        />
      </Host>
    </View>
  );
}

export const Button = ({ className, disabled, onPress, label, size }: Props) => (
  <BaseButton
    className={className}
    disabled={disabled}
    onPress={onPress}
    label={label}
    size={size}
    tintColor={colors.accent.DEFAULT}
    variant="filled"
  />
);

export const OutlinedButton = ({
  className,
  onPress,
  label,
  color = colors.danger.DEFAULT,
  size = "md",
}: Props) => (
  <BaseButton
    className={className}
    onPress={onPress}
    label={label}
    size={size}
    tintColor={color}
    variant="outlined"
  />
);

export const TextButton = ({ className, onPress, label, size = "md" }: Props) => (
  <BaseButton
    className={clsx("min-h-11 px-2 py-1", className)}
    onPress={onPress}
    label={label}
    size={size}
    tintColor={colors.primary.text}
    variant="text"
  />
);
