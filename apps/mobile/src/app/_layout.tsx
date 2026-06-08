import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_500Medium,
  Nunito_500Medium_Italic,
  Nunito_600SemiBold,
  Nunito_600SemiBold_Italic,
  Nunito_700Bold,
  Nunito_700Bold_Italic,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AppProviders } from "~/app-shell/app-providers";
import { SetupGate } from "~/app-shell/setup/setup-gate";
import { configureDevelopmentMenuPreferences } from "~/platform/dev-menu-preferences";
import { fontNames } from "~/components/ui/text";
import { colors } from "~/theme/colors";
import "../global.css";

void SplashScreen.preventAutoHideAsync();
configureDevelopmentMenuPreferences();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_400Regular_Italic,
    Nunito_500Medium,
    Nunito_500Medium_Italic,
    Nunito_600SemiBold,
    Nunito_600SemiBold_Italic,
    Nunito_700Bold,
    Nunito_700Bold_Italic,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProviders>
      <SetupGate>
        <AppNavigator />
      </SetupGate>
    </AppProviders>
  );
}

function AppNavigator() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary.DEFAULT,
        },
        headerTintColor: colors.on.primary,
        headerTitleStyle: {
          color: colors.on.primary,
          fontFamily: fontNames.bold,
        },
        headerBackTitle: "Zurück",
        headerBackButtonDisplayMode: "minimal",
        contentStyle: {
          backgroundColor: colors.surface,
        },
      }}
    >
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
    </Stack>
  );
}
