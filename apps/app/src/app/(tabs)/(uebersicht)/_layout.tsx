import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Stack } from "expo-router";
import { Platform } from "react-native";

// A link straight to /selbsttest still opens on top of the overview, so back leads somewhere.
export const unstable_settings = { initialRouteName: "index" };

export default function OverviewLayout() {
  const { color } = Theme.useTheme();

  // The add and edit sheet. The phones present the system's sheet, which closes on a swipe down; the
  // web keeps the page below and draws its own sheet over it (ui/Sheet.web.tsx).
  const sheet = (title: string) =>
    Platform.OS === "web"
      ? {
          title,
          headerShown: false,
          presentation: "transparentModal" as const,
          animation: "fade" as const,
        }
      : {
          title,
          headerShown: false,
          presentation: "formSheet" as const,
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
          sheetCornerRadius: Tokens.radius.panel,
          contentStyle: { backgroundColor: color.surface },
        };

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
      {/* Homework's pages draw Flutter's blue header with its own way back. */}
      <Stack.Screen
        name="hausaufgaben/index"
        options={{ title: "Hausaufgaben", headerShown: false }}
      />
      <Stack.Screen
        name="hausaufgaben/[id]/index"
        options={{ title: "Hausaufgabe", headerShown: false }}
      />
      <Stack.Screen name="hausaufgaben/neu" options={sheet("Hausaufgabe hinzufügen")} />
      <Stack.Screen name="hausaufgaben/[id]/bearbeiten" options={sheet("Hausaufgabe bearbeiten")} />
      <Stack.Screen
        name="selbsttest"
        options={{ title: "Verschlüsselung", headerLargeTitle: Platform.OS === "ios" }}
      />
    </Stack>
  );
}
