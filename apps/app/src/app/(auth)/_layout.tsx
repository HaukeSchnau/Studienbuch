import { Stack } from "expo-router";
import { Platform } from "react-native";

import { SignedOut } from "../../features/account/AccountGates.tsx";

export const unstable_settings = { anchor: "anmelden" };

// The hero carries each title. On iOS the header only adds a back button over it. Android has the
// system back gesture, and the web browser history; a header there would sit on the title, because
// only iOS insets the scroll view below a transparent header.
export default function AuthLayout() {
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
      >
        <Stack.Screen name="anmelden" options={{ headerShown: false }} />
        <Stack.Screen name="konto-anlegen" />
        <Stack.Screen name="e-mail-bestaetigen" />
        <Stack.Screen name="passkey-test" />
      </Stack>
    </SignedOut>
  );
}
