import { View } from "react-native";

import type { Color } from "@acme/tailwind-config";
import { getColorValue } from "@acme/tailwind-config";

interface Props {
  size: number;
  color: Color;
}

export const Circle = ({ size, color }: Props) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: getColorValue(color) ?? color,
    }}
  />
);
