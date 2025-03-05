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
    android: "Nunito_400Regular",
    ios: "Nunito-Regular",
  }),
  "regular-italic": Platform.select({
    android: "Nunito_400Regular_Italic",
    ios: "Nunito-Italic",
  }),
  medium: Platform.select({
    android: "Nunito_500Medium",
    ios: "Nunito-Medium",
  }),
  "medium-italic": Platform.select({
    android: "Nunito_500Medium_Italic",
    ios: "Nunito-Medium-Italic",
  }),
  "semi-bold": Platform.select({
    android: "Nunito_600SemiBold",
    ios: "Nunito-SemiBold",
  }),
  "semi-bold-italic": Platform.select({
    android: "Nunito_600SemiBold_Italic",
    ios: "Nunito-SemiBold-Italic",
  }),
  bold: Platform.select({
    android: "Nunito_700Bold",
    ios: "Nunito-Bold",
  }),
  "bold-italic": Platform.select({
    android: "Nunito_700Bold_Italic",
    ios: "Nunito-Bold-Italic",
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
