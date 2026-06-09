import { Button as ExpoButton, Host, Text as ExpoText } from "@expo/ui";
import {
  buttonBorderShape,
  buttonStyle,
  font,
  foregroundStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import clsx from "clsx";
import { Platform, View } from "react-native";

import { haptics } from "~/platform/haptics";
import { colors } from "~/theme/colors";
import { nativeHostThemeProps } from "./native-theme";
import { fontNames } from "./text";

interface Props {
  label: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  color?: string;
  size?: "sm" | "md";
}

const baseButtonStyle = {
  sm: { height: 44, borderRadius: 999 },
  md: { height: 48, borderRadius: 999 },
} as const;

const fontSize = {
  sm: 16,
  md: 17,
} as const;

const fallbackStyle = (
  variant: "filled" | "outlined" | "text",
  tintColor: string,
  size: "sm" | "md",
) => {
  if (Platform.OS !== "web") {
    return baseButtonStyle[size];
  }

  if (variant === "filled") {
    return {
      ...baseButtonStyle[size],
      backgroundColor: tintColor,
      paddingHorizontal: 18,
      paddingVertical: 10,
    };
  }

  if (variant === "outlined") {
    return {
      ...baseButtonStyle[size],
      borderColor: tintColor,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 10,
    };
  }

  return {
    ...baseButtonStyle[size],
    paddingHorizontal: 12,
    paddingVertical: 8,
  };
};

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
  const resolvedTintColor = tintColor ?? colors.accent.DEFAULT;
  const labelColor = disabled
    ? colors.neutral.DEFAULT
    : variant === "filled"
      ? colors.on.primary
      : resolvedTintColor;
  const labelTextStyle = {
    color: labelColor,
    fontFamily: fontNames["semi-bold"],
    fontSize: fontSize[size],
    fontWeight: "600" as const,
    textAlign: "center" as const,
  };
  const modifiers =
    Platform.OS === "ios"
      ? [
          buttonBorderShape("capsule"),
          tint(resolvedTintColor),
          ...(variant === "text" ? [buttonStyle("borderless")] : []),
          font({
            family: fontNames["semi-bold"],
            size: fontSize[size],
            weight: "semibold",
          }),
          foregroundStyle(labelColor),
        ]
      : undefined;

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={clsx("items-center justify-center", className)}
    >
      <Host matchContents {...nativeHostThemeProps(resolvedTintColor)}>
        <ExpoButton
          disabled={disabled}
          onPress={() => {
            haptics.selection();
            onPress?.();
          }}
          style={fallbackStyle(variant, resolvedTintColor, size)}
          modifiers={modifiers}
          variant={variant}
          label={Platform.OS === "ios" ? label : undefined}
        >
          {Platform.OS === "ios" ? undefined : (
            <ExpoText numberOfLines={1} textStyle={labelTextStyle}>
              {label}
            </ExpoText>
          )}
        </ExpoButton>
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
