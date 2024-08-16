import type { ComponentProps } from "react";
import { forwardRef } from "react";
import { Text as RNText } from "react-native";
import Animated from "react-native-reanimated";

interface Props extends ComponentProps<typeof RNText> {
  weight?: "regular" | "bold";
}

export const Text = ({ weight = "regular", ...props }: Props) => {
  const fontFamily = (() => {
    switch (weight) {
      case "regular":
        return "Nunito_400Regular";
      case "bold":
        return "Nunito_700Bold";
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
