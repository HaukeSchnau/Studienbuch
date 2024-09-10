import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

import { shadow } from "./styles/shadow";

export const Card = ({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  return (
    <View
      style={[
        {
          backgroundColor: "white",
          borderRadius: 24,
          padding: 16,
        },
        shadow,
        style,
      ]}
      className={className}
    >
      {children}
    </View>
  );
};
