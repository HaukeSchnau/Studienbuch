import { Button as ExpoButton, Host } from "@expo/ui";
import clsx from "clsx";
import { View, type StyleProp, type ViewStyle } from "react-native";

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

const sizeClassNameMap = {
  sm: "min-h-11 px-5 py-2",
  md: "min-h-12 px-6 py-3",
} as const;

const baseButtonStyle = {
  sm: { paddingHorizontal: 20, paddingVertical: 8 },
  md: { paddingHorizontal: 24, paddingVertical: 12 },
} as const;

function BaseButton({
  className,
  disabled,
  onPress,
  label,
  size = "md",
  backgroundColor,
  borderColor,
  rounded = true,
  style,
}: Props & {
  backgroundColor?: string;
  borderColor?: string;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const variant = borderColor ? "outlined" : backgroundColor ? "filled" : "text";

  return (
    <View
      className={clsx(
        rounded ? "rounded-full" : null,
        "items-center justify-center",
        sizeClassNameMap[size],
        className,
      )}
      style={[
        backgroundColor ? { backgroundColor } : undefined,
        borderColor ? { borderColor, borderWidth: 1 } : undefined,
        rounded ? { borderRadius: 999 } : undefined,
        style,
      ]}
    >
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
            ...(backgroundColor ? { backgroundColor } : null),
            ...(borderColor ? { borderColor, borderWidth: 1 } : null),
            borderRadius: rounded ? 999 : 8,
          }}
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
    backgroundColor={disabled ? colors.neutral.DEFAULT : colors.accent.DEFAULT}
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
    backgroundColor={colors.surface}
    borderColor={color}
  />
);

export const TextButton = ({ className, onPress, label, size = "md" }: Props) => (
  <BaseButton
    className={clsx("min-h-11 px-2 py-1", className)}
    onPress={onPress}
    label={label}
    size={size}
    rounded={false}
  />
);
