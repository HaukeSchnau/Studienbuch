import { Stack } from "expo-router";
import { Platform } from "react-native";

import { SignedIn } from "../../features/account/AccountGates.tsx";

// The notebook's key screens, for a signed-in device. The hero carries each title; on iOS the
// header only adds a back button over it, as on the sign-in screens.
export default function KeysLayout() {
  return (
    <SignedIn>
      <Stack
        screenOptions={{
          headerShown: Platform.OS === "ios",
          headerTransparent: true,
          headerTitle: "",
          headerTintColor: "#FFFFFF",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
    </SignedIn>
  );
}
