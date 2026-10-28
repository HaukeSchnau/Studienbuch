import { Stack } from "expo-router";
import { Platform } from "react-native";

// A link straight to /selbsttest still opens on top of the overview, so back leads somewhere.
export const unstable_settings = { initialRouteName: "index" };

export default function OverviewLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", headerShadowVisible: false }}>
      {/* The hero carries the title. Without toolbar buttons yet, an empty header row would only
          push it down (the mock keeps the row for its "+"). */}
      <Stack.Screen name="index" options={{ title: "Übersicht", headerShown: false }} />
      <Stack.Screen
        name="selbsttest"
        options={{ title: "Verschlüsselung", headerLargeTitle: Platform.OS === "ios" }}
      />
    </Stack>
  );
}
