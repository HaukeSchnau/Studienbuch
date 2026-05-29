import clsx from "clsx";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { View } from "react-native";
import { colors } from "~/theme/colors";

interface Props {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  focused?: boolean;
}

export const FieldSurface = ({ children, className, style, focused = false }: Props) => {
  return (
    <View
      className={clsx("rounded-[24px] border bg-[#F6F8FB]", className)}
      style={[{ borderColor: focused ? colors.accent.pale : "#DCE4EE" }, style]}
    >
      {children}
    </View>
  );
};
