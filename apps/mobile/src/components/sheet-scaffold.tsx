import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./text";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const SheetScaffold = ({ title, subtitle, children, footer }: Props) => {
  return (
    <View className="px-4 py-2">
      <Text variant="heading" className="text-center">
        {title}
      </Text>

      {subtitle ? (
        <>
          <View className="h-2" />
          <Text className="px-4 text-center text-base opacity-70">{subtitle}</Text>
        </>
      ) : null}

      <View className="h-4" />
      {children}

      {footer ? (
        <>
          <View className="h-6" />
          {footer}
        </>
      ) : null}
    </View>
  );
};
