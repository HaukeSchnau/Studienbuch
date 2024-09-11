import { useMemo } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Card } from "~/components/card";
import { Text } from "~/components/text";
import { api } from "~/utils/api";
import BackgroundImage from "../../../assets/home-bg.svg";

export default function OverviewPage() {
  return (
    <>
      <StatusBar style="light" />
      <Background />
      <SafeAreaView>
        <View className="h-4" />

        <Greeting />
        <Text className="color-white px-8 text-2xl">Das steht heute an:</Text>

        <View className="h-4" />

        <Agenda />
      </SafeAreaView>
    </>
  );
}

const Greeting = () => {
  const session = api.auth.getSession.useQuery();

  if (session.isLoading) {
    return <Text>Loading...</Text>;
  }

  if (session.error) {
    return <Text>Session Error: {session.error.message}</Text>;
  }

  if (!session.data?.user) {
    return <Text>Not authenticated. This should not happen.</Text>;
  }

  return (
    <Text className="color-white px-8 text-4xl" variant="heading">
      Moin, {session.data.user.name}!
    </Text>
  );
};

const Agenda = () => {
  const today = useMemo(() => new Date(), []);
  api.timetable.getWeek.useQuery({ date: today });

  return (
    <Card className="mx-8">
      <Text>Card Content</Text>
    </Card>
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
