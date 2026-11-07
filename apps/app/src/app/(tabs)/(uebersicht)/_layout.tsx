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
      {/* Its hero carries the title too; on iOS the header adds only the way back over it. */}
      <Stack.Screen
        name="diagnose"
        options={{
          title: "Dieses Gerät",
          headerShown: Platform.OS === "ios",
          headerTransparent: true,
          headerTitle: "",
          headerTintColor: "#FFFFFF",
        }}
      />
      <Stack.Screen
        name="selbsttest"
        options={{ title: "Verschlüsselung", headerLargeTitle: Platform.OS === "ios" }}
      />
    </Stack>
  );
}
