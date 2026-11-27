import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Stack } from "expo-router";
import { Platform } from "react-native";

// One stack per tab. A link straight to a lesson or a homework page still opens on top of the tab's
// first screen, so back leads somewhere.
export const unstable_settings = { uebersicht: { anchor: "index" }, woche: { anchor: "woche" } };

/**
 * The stacks of the Übersicht and Meine Woche. The lesson sheet and homework's pages open in the
 * tab they were opened from, and back returns there: a link without a group resolves to the
 * current tab's copy. `segment` names the tab, as `(uebersicht)`.
 */
export default function PlannerLayout({ segment }: { readonly segment: string }) {
  const { color } = Theme.useTheme();

  // The lesson sheet and the add and edit sheet. The phones present the system's sheet, which closes
  // on a swipe down; the web keeps the page below and draws its own sheet over it (ui/Sheet.web.tsx).
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
      {/* The hero carries the title, and in Meine Woche the week arrows. Without toolbar buttons
          yet, an empty header row would only push it down (the mock keeps the row for its "+"). */}
      {segment === "(woche)" ? (
        <Stack.Screen name="woche" options={{ title: "Meine Woche", headerShown: false }} />
      ) : (
        <Stack.Screen name="index" options={{ title: "Übersicht", headerShown: false }} />
      )}
      {/* Homework's pages draw Flutter's blue header with its own way back. */}
      <Stack.Screen
        name="hausaufgaben/index"
        options={{ title: "Hausaufgaben", headerShown: false }}
      />
      <Stack.Screen
        name="hausaufgaben/[id]/index"
        options={{ title: "Hausaufgabe", headerShown: false }}
      />
      <Stack.Screen name="stunden/[id]" options={sheet("Stunde")} />
      <Stack.Screen name="hausaufgaben/neu" options={sheet("Hausaufgabe hinzufügen")} />
      <Stack.Screen name="hausaufgaben/[id]/bearbeiten" options={sheet("Hausaufgabe bearbeiten")} />
    </Stack>
  );
}
