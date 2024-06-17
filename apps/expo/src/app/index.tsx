import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

export default function Index() {
  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Home Page" }} />
    </SafeAreaView>
  );
}
