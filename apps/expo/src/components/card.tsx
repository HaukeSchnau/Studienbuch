import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { TouchableOpacity } from "react-native-gesture-handler";

import { shadow } from "./styles/shadow";

export const Card = ({
  children,
  className,
  style,
  onPress,
}: {
  children?: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) => {
  const content = (
    <View
      style={[
        {
          backgroundColor: "white",
          borderRadius: 32,
          padding: 24,
        },
        shadow,
        style,
      ]}
      className={className}
    >
      {children}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
};
