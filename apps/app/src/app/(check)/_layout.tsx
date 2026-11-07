import { Stack } from "expo-router";
import { Platform } from "react-native";

import { SignedOut } from "../../features/account/AccountGates.tsx";

// The passkey device check (PasskeyCheckScreen.tsx) keeps the hero screens, outside the sign-in
// card. On iOS the header only adds a back button over the hero, as before.
export default function CheckLayout() {
  return (
    <SignedOut>
      <Stack
        screenOptions={{
          headerShown: Platform.OS === "ios",
          headerTransparent: true,
          headerTitle: "",
          headerTintColor: "#FFFFFF",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
    </SignedOut>
  );
}
