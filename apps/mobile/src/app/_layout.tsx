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
import { Redirect, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PortalRenderer } from "~/components/portal";
import { MockAppProvider, useMockApp } from "~/mock-app/provider";
import { colors } from "~/theme/colors";
import "../global.css";

void SplashScreen.preventAutoHideAsync();

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
    <MockAppProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AppNavigator />
        <PortalRenderer />
      </GestureHandlerRootView>
    </MockAppProvider>
  );
}

function AppNavigator() {
  const segments = useSegments();
  const { getRequiredSetupPath } = useMockApp();
  const requiredSetupPath = getRequiredSetupPath();
  const isSetupRoute = segments[0] === "setup";

  if (requiredSetupPath && !isSetupRoute) {
    return <Redirect href={requiredSetupPath} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary.DEFAULT,
        },
        headerTintColor: colors.on.primary,
        headerTitleStyle: {
          color: colors.on.primary,
          fontFamily: "Nunito_700Bold",
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
