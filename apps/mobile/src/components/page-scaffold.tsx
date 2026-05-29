import clsx from "clsx";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";

interface Props {
  title: string;
  children: ReactNode;
  contentClassName?: string;
  useDefaultPadding?: boolean;
}

export const PageScaffold = ({
  title,
  children,
  contentClassName,
  useDefaultPadding = true,
}: Props) => {
  return (
    <ScrollView className="flex-1 bg-background">
      <Stack.Screen options={{ title }} />
      <View className={clsx(useDefaultPadding ? "px-5 pb-8 pt-5" : null, contentClassName)}>
        {children}
      </View>
    </ScrollView>
  );
};
