import type { ComponentProps } from "react";
import { Platform, Text as RNText } from "react-native";
import clsx from "clsx";

interface Props extends ComponentProps<typeof RNText> {
  weight?: "regular" | "medium" | "semi-bold" | "bold";
  italic?: boolean;
  variant?: "heading";
}

const fontNames = {
  regular: Platform.select({
    ios: "Nunito_400Regular",
    android: "Nunito-Regular",
  }),
  "regular-italic": Platform.select({
    ios: "Nunito_400Regular_Italic",
    android: "Nunito-Italic",
  }),
  medium: Platform.select({
    ios: "Nunito_500Medium",
    android: "Nunito-Medium",
  }),
  "medium-italic": Platform.select({
    ios: "Nunito_500Medium_Italic",
    android: "Nunito-Medium-Italic",
  }),
  "semi-bold": Platform.select({
    ios: "Nunito_600SemiBold",
    android: "Nunito-SemiBold",
  }),
  "semi-bold-italic": Platform.select({
    ios: "Nunito_600SemiBold_Italic",
    android: "Nunito-SemiBold-Italic",
  }),
  bold: Platform.select({
    ios: "Nunito_700Bold",
    android: "Nunito-Bold",
  }),
  "bold-italic": Platform.select({
    ios: "Nunito_700Bold_Italic",
    android: "Nunito-Bold-Italic",
  }),
};

export const Text = ({
  weight = "regular",
  italic,
  variant,
  ...props
}: Props) => {
  switch (variant) {
    case "heading":
      return (
        <RNText
          {...props}
          style={[
            {
              fontFamily: fontNames.bold,
            },
            props.style,
          ]}
          className={clsx("text-3xl text-primary-text", props.className)}
        />
      );
  }

  const fontFamily = italic
    ? `${fontNames[`${weight}-italic`]}`
    : fontNames[weight];

  return (
    <RNText
      {...props}
      style={[
        {
          fontFamily,
        },
        props.style,
      ]}
    />
  );
};
