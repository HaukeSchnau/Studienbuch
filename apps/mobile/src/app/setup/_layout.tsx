import { Slot, Stack } from "expo-router";
import { SetupScreenLayout } from "~/features/setup/setup-screen-layout";

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
