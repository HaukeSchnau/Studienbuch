import "@bacons/text-decoder/install";

import { Stack, useNavigationContainerRef } from "expo-router";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import type { ReactNode } from "react";
import { lazy, useEffect } from "react";
import { UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Constants, { AppOwnership } from "expo-constants";
import * as SplashScreen from "expo-splash-screen";
import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";
import * as Sentry from "@sentry/react-native";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { colors } from "@stu/tailwind-config/native";

import { PortalRenderer } from "~/components/portal";
import { db } from "~/db/client";
import { useSessionWatcher } from "~/utils/auth";
import migrations from "../../drizzle/migrations";

const DevTools = lazy(() =>
  import("~/components/dev/dev-menu").then((mod) => ({
    default: mod.DevTools,
  })),
);

const routingInstrumentation = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: Constants.appOwnership !== AppOwnership.Expo, // Only in native builds, not in Expo Go.
});

Sentry.init({
  dsn: __DEV__
    ? "https://2a803fff45e5c6604fb7742583d0acbc@o1058251.ingest.us.sentry.io/4508083332382720"
    : "https://d950b351307f4e39b529fe22cff83ecb@o1058251.ingest.us.sentry.io/4508059227258880",

  enableSpotlight: __DEV__,

  integrations: [
    Sentry.reactNativeTracingIntegration({
      routingInstrumentation,
      enableNativeFramesTracking: Constants.appOwnership !== AppOwnership.Expo, // Only in native builds, not in Expo Go.
    }),
  ],
});

void SplashScreen.preventAutoHideAsync();

if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function RootLayout() {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    routingInstrumentation.registerNavigationContainer(ref);
  }, [ref]);

  const { success: migrationSuccess, error: migrationError } = useMigrations(
    db,
    migrations,
  );

  const [fontLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_400Regular_Italic,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  const sessionLoading = useSessionWatcher();

  const isLoaded =
    (fontLoaded || !!fontError) &&
    (migrationSuccess || !!migrationError) &&
    !sessionLoading;

  useEffect(() => {
    if (isLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView>
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
          contentStyle: {
            backgroundColor: "#FFFFFF",
          },
        }}
      />

      {__DEV__ && <DevTools />}

      <PortalRenderer />
    </GestureHandlerRootView>
  );
}

const RootLayoutWrapper = () => {
  return (
    <Providers>
      <RootLayout />
    </Providers>
  );
};

export default Sentry.wrap(RootLayoutWrapper);

const Providers = ({ children }: { children: ReactNode }) => {
  return <TRPCProvider>{children}</TRPCProvider>;
};
