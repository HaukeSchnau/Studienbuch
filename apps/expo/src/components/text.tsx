import type { ComponentProps } from "react";
import { Text as RNText } from "react-native";
import clsx from "clsx";

interface Props extends ComponentProps<typeof RNText> {
  weight?: "regular" | "medium" | "semi-bold" | "bold";
  italic?: boolean;
  variant?: "heading";
}

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
              fontFamily: "Nunito_700Bold",
            },
            props.style,
          ]}
          className={clsx("text-3xl text-primary-text", props.className)}
        />
      );
  }

  const fontFamilyWithWeight = (() => {
    switch (weight) {
      case "regular":
        return "Nunito_400Regular";
      case "medium":
        return "Nunito_500Medium";
      case "semi-bold":
        return "Nunito_600SemiBold";
      case "bold":
        return "Nunito_700Bold";
    }
  })();

  const fontFamily = italic
    ? `${fontFamilyWithWeight}_Italic`
    : fontFamilyWithWeight;

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
