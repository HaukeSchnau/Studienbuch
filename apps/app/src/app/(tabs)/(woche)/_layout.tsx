import { Stack } from "expo-router";

export default function WeekLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", headerShadowVisible: false }}>
      {/* The hero carries the title and the week arrows. */}
      <Stack.Screen name="woche" options={{ title: "Meine Woche", headerShown: false }} />
    </Stack>
  );
}
