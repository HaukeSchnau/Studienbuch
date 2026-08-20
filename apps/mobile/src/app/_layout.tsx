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
import { ObserveRoot, useObserve } from "expo-observe";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { AppProviders } from "~/infra/providers";
import { SetupGate } from "~/features/setup/setup-gate";
import { withMobileCrashReporting } from "~/infra/observability/sentry";
import { configureDevelopmentMenuPreferences } from "~/infra/native/dev-menu-preferences";
import "../global.css";

void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const { markInteractive } = useObserve();
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
    configureDevelopmentMenuPreferences();

    if (fontsLoaded) {
      void SplashScreen.hideAsync().finally(() => {
        markInteractive({ params: { readyState: "fonts-loaded" } });
      });
    }
  }, [fontsLoaded, markInteractive]);

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

export default withMobileCrashReporting(ObserveRoot.wrap(RootLayout));

function AppNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(app)" />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
    </Stack>
  );
}
