import { Slot, Stack } from "expo-router";
import { SetupScreenLayout } from "~/app-shell/setup/setup-screen-layout";

export default function SetupLayout() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SetupScreenLayout>
        <Slot />
      </SetupScreenLayout>
    </>
  );
}
