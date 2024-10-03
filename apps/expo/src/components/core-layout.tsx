import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Text } from "~/components/text";
import { AbsencesOverviewCard } from "~/features/absences/absences-overview-card";
import { Agenda } from "~/features/agenda/agenda";
import { Tasks } from "~/features/tasks/tasks";
import { api } from "~/utils/api";
import BackgroundImage from "../../assets/home-bg.svg";

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
  return (
    <View>
      <View className="absolute left-0 top-0 h-full w-full">
        <View className="h-1/2 bg-primary" />
        <View className="h-1/2 bg-white" />
      </View>

      <ScrollView>
        <StatusBar style="light" />
        <View className="bg-white">
          <Background />
          <SafeAreaView>{children}</SafeAreaView>
        </View>
      </ScrollView>
    </View>
  );
};
