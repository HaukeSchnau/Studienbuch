import { Stack } from "expo-router";
import { Platform } from "react-native";

// A link straight to /diagnose or /selbsttest still opens on top of Profil, so back leads somewhere.
export const unstable_settings = { anchor: "profil" };

// The hero carries each title. On iOS the header adds only the way back over it; the web and
// Android draw "Zurück" in the hero (HeroScreen's `back`).
const overHero = {
  headerShown: Platform.OS === "ios",
  headerTransparent: true,
  headerTitle: "",
  headerTintColor: "#FFFFFF",
} as const;

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", headerShadowVisible: false }}>
      <Stack.Screen name="profil" options={{ title: "Profil", headerShown: false }} />
      <Stack.Screen name="diagnose" options={{ title: "Diagnose", ...overHero }} />
      <Stack.Screen name="konto-loeschen" options={{ title: "Konto löschen", ...overHero }} />
      <Stack.Screen
        name="selbsttest"
        options={{ title: "Verschlüsselung", headerLargeTitle: Platform.OS === "ios" }}
      />
    </Stack>
  );
}
