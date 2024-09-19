import { ActivityIndicator, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Text } from "~/components/text";
import { AbsencesOverviewCard } from "~/features/absences/absences-overview-card";
import { Agenda } from "~/features/agenda/agenda";
import { Tasks } from "~/features/tasks/tasks";
import { api } from "~/utils/api";
import BackgroundImage from "../../../assets/home-bg.svg";

export default function OverviewPage() {
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
          <SafeAreaView>
            <View className="px-8">
              <View className="h-4" />

              <Greeting />
              <Agenda />

              <View className="h-8" />

              <AbsencesOverviewCard />
            </View>

            <View className="h-8" />

            <Tasks />
          </SafeAreaView>
        </View>
      </ScrollView>
    </View>
  );
}

const Greeting = () => {
  const session = api.auth.getSession.useQuery();

  if (session.isPending) {
    return <ActivityIndicator />;
  }

  if (session.error) {
    return <Text>Session Error: {session.error.message}</Text>;
  }

  if (!session.data?.user) {
    return <Text>Not authenticated. This should not happen.</Text>;
  }

  return (
    <Text className="color-white text-4xl" variant="heading">
      Moin, {session.data.user.name}!
    </Text>
  );
};

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
