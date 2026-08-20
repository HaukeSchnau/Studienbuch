import { Stack } from "expo-router";
import { appStackScreenOptions } from "~/ui/navigation/app-stack-options";

export default function AppLayout() {
  return (
    <Stack screenOptions={appStackScreenOptions}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
