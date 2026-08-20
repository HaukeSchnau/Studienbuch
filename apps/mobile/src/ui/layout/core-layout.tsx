import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BackgroundImage from "~/assets/home-bg.svg";
import { useMainTabBarPadding } from "../use-main-tab-bar-padding";

const Background = () => (
  <View
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    }}
  >
    <View className="h-16 bg-primary" />
    <BackgroundImage width="100%" preserveAspectRatio="none" />
  </View>
);

interface Props {
  children: ReactNode;
}

export const CoreLayout = ({ children }: Props) => {
  const bottomPadding = useMainTabBarPadding(16);

  return (
    <View className="flex-1 overflow-hidden bg-white">
      <View className="absolute top-0 left-0 h-full w-full">
        <View className="h-1/2 bg-primary" />
        <View className="h-1/2 bg-white" />
      </View>

      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
      >
        <StatusBar style="light" />
        <View className="bg-white">
          <Background />
          <SafeAreaView edges={["top"]}>{children}</SafeAreaView>
        </View>
      </ScrollView>
    </View>
  );
};
