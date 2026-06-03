import clsx from "clsx";
import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  title: string;
  children: ReactNode;
  contentClassName?: string;
  useDefaultPadding?: boolean;
  headerRight?: ReactNode;
}

export const PageScaffold = ({
  title,
  children,
  contentClassName,
  useDefaultPadding = true,
  headerRight,
}: Props) => {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title }} />
      {headerRight ? <Stack.Toolbar placement="right">{headerRight}</Stack.Toolbar> : null}
      <ScrollView
        className="flex-1 bg-background"
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          className={clsx(useDefaultPadding ? "px-5 pt-5" : null, contentClassName)}
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          {children}
        </View>
      </ScrollView>
    </>
  );
};
