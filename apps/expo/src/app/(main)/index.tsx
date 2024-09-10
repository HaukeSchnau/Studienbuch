import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Text } from "~/components/text";
import { api } from "~/utils/api";
import BackgroundImage from "../../../assets/home-bg.svg";

export default function OverviewPage() {
  const session = api.auth.getSession.useQuery();

  if (session.isLoading) {
    return <Text>Loading...</Text>;
  }

  if (session.error) {
    return <Text>Error: {session.error.message}</Text>;
  }

  if (!session.data) {
    return <Text>Not authenticated</Text>;
  }

  return (
    <>
      <StatusBar style="light" />
      <Background />
      <SafeAreaView>
        <View className="h-4" />

        <Text className="color-white px-8 text-4xl" variant="heading">
          Moin, {session.data.user?.name}!
        </Text>
        <Text className="color-white px-8 text-2xl">Das steht heute an:</Text>

        <View className="h-4" />

        
      </SafeAreaView>
    </>
  );
}

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
