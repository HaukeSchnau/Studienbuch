import clsx from "clsx";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";

interface Props {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const FieldSurface = ({ children, className, style }: Props) => {
  return (
    <View className={clsx("rounded-3xl bg-[#E6E6E6]", className)} style={style}>
      {children}
    </View>
  );
};
