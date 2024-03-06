import { View } from "react-native";

interface Props {
  size: number;
  color: string;
}

export const Circle = ({ size, color }: Props) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
    }}
  />
);
