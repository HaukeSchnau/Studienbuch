import { Stack } from "expo-router";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import { lazy, useEffect } from "react";
import { UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { colors } from "@stu/tailwind-config/native";

import { PortalRenderer } from "~/components/portal";
import { db } from "~/db/client";
import { useSessionWatcher } from "~/utils/auth";
import { MutationManager } from "~/utils/events/mutation-manager";
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

  const sessionLoading = useSessionWatcher();

  const isLoaded = (migrationSuccess || !!migrationError) && !sessionLoading;

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hide();
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

export default () => (
  <TRPCProvider>
    <RootLayout />
  </TRPCProvider>
);
