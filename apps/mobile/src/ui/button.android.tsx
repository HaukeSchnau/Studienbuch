import {
  ComposeButton,
  ComposeHost,
  ComposeOutlinedButton,
  ComposePill,
  ComposeText,
  ComposeTextButton,
  height,
} from "~/ui/native/expo-ui-compose";
import clsx from "clsx";
import { View } from "react-native";

import { haptics } from "~/infra/native/haptics";
import { colors } from "~/ui/colors";
import { fontNames } from "./text";

interface Props {
  label: string;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  color?: string;
  size?: "sm" | "md";
}

const buttonHeight = {
  sm: 48,
  md: 48,
} as const;

const fontSize = {
  sm: 16,
  md: 17,
} as const;

type Variant = "filled" | "outlined" | "text";

const disabledContentColor = "#9AA3AF";

function ButtonLabel({
  disabled,
  label,
  size,
  variant,
  tintColor,
}: {
  disabled?: boolean;
  label: string;
  size: "sm" | "md";
  variant: Variant;
  tintColor: string;
}) {
  const labelColor = disabled
    ? disabledContentColor
    : variant === "filled"
      ? colors.on.primary
      : tintColor;

  return (
    <ComposeText
      color={labelColor}
      maxLines={1}
      softWrap={false}
      style={{
        fontFamily: fontNames["semi-bold"],
        fontSize: fontSize[size],
        fontWeight: "600",
        textAlign: "center",
      }}
    >
      {label}
    </ComposeText>
  );
}

function BaseButton({
  className,
  disabled,
  label,
  onPress,
  size = "md",
  tintColor,
  variant,
}: Props & {
  tintColor: string;
  variant: Variant;
}) {
  const ButtonComponent =
    variant === "filled"
      ? ComposeButton
      : variant === "outlined"
        ? ComposeOutlinedButton
        : ComposeTextButton;

  const nativeColors =
    variant === "filled"
      ? {
          containerColor: tintColor,
          contentColor: colors.on.primary,
          disabledContainerColor: colors.neutral.sec,
          disabledContentColor,
        }
      : {
          containerColor: "transparent",
          contentColor: tintColor,
          disabledContentColor,
        };

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={clsx("items-center justify-center", className)}
    >
      <ComposeHost matchContents seedColor={tintColor}>
        <ButtonComponent
          colors={nativeColors}
          enabled={!disabled}
          modifiers={[height(buttonHeight[size])]}
          onClick={() => {
            haptics.selection();
            onPress?.();
          }}
          {...{ ["shape"]: ComposePill({}) }}
        >
          <ButtonLabel
            disabled={disabled}
            label={label}
            size={size}
            tintColor={tintColor}
            variant={variant}
          />
        </ButtonComponent>
      </ComposeHost>
    </View>
  );
}

export const Button = ({ className, disabled, onPress, label, size }: Props) => (
  <BaseButton
    className={className}
    disabled={disabled}
    label={label}
    onPress={onPress}
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
    label={label}
    onPress={onPress}
    size={size}
    tintColor={color}
    variant="outlined"
  />
);

export const TextButton = ({ className, onPress, label, size = "md" }: Props) => (
  <BaseButton
    className={clsx("min-h-12 px-2 py-1", className)}
    label={label}
    onPress={onPress}
    size={size}
    tintColor={colors.primary.text}
    variant="text"
  />
);
