import { Stack } from "expo-router";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import type { ReactNode } from "react";
import { lazy, useEffect } from "react";
import { UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import {
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { colors } from "@stu/tailwind-config/native";

import { PortalRenderer } from "~/components/portal";
import { db } from "~/db/client";
import { useSessionWatcher } from "~/utils/auth";
import { MutationManager } from "~/utils/local-trpc/persisting-query-client";
import migrations from "../../drizzle/migrations";

const DevTools = lazy(() =>
  import("~/components/dev/dev-menu").then((mod) => ({
    default: mod.DevTools,
  })),
);

void SplashScreen.preventAutoHideAsync();

if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function RootLayout() {
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
    <MutationManager>
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
    </MutationManager>
  );
}

const RootLayoutWrapper = () => {
  return (
    <Providers>
      <RootLayout />
    </Providers>
  );
};

export default RootLayoutWrapper;

const Providers = ({ children }: { children: ReactNode }) => {
  return <TRPCProvider>{children}</TRPCProvider>;
};
