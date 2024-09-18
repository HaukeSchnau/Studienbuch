import type { ComponentProps } from "react";
import { Text as RNText } from "react-native";
import clsx from "clsx";

interface Props extends ComponentProps<typeof RNText> {
  weight?: "regular" | "medium" | "bold";
  variant?: "heading";
}

export const Text = ({ weight = "regular", variant, ...props }: Props) => {
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

  const fontFamily = (() => {
    switch (weight) {
      case "regular":
        return "Nunito_400Regular";
      case "bold":
        return "Nunito_700Bold";
      case "medium":
        return "Nunito_500Medium";
    }
  })();

  return (
    <RNText
      style={[
        {
          fontFamily,
        },
        props.style,
      ]}
      {...props}
    />
  );
};
