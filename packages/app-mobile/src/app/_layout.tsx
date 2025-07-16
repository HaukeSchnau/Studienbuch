import { Stack } from "expo-router";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import * as SplashScreen from "expo-splash-screen";
import { lazy, useEffect } from "react";
import { UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { colors } from "@stu/tailwind-config/native";

import { PortalRenderer } from "~/components/portal";
import { DatabaseLive, db } from "~/db/client";
import { useSessionWatcher } from "~/utils/auth";
import { MissingInfoGuard } from "~/utils/missing-info-guard";
import migrations from "../../drizzle/migrations";
import { Layer, ManagedRuntime } from "effect";
import { SyncEngineLive } from "~/utils/groundswell";
import { SyncEngineProvider } from "~/utils/events/ingest";

const DevTools = lazy(() =>
  import("~/components/dev/dev-menu").then((mod) => ({
    default: mod.DevTools,
  })),
);

void SplashScreen.preventAutoHideAsync();

if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const runtime = ManagedRuntime.make(SyncEngineLive.pipe(Layer.provideMerge(DatabaseLive)));

function RootLayout() {
  const { success: migrationSuccess, error: migrationError } = useMigrations(db, migrations);

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
    <SyncEngineProvider value={runtime}>
      <GestureHandlerRootView>
        <Stack
          layout={({ children }) => <MissingInfoGuard>{children}</MissingInfoGuard>}
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
    </SyncEngineProvider>
  );
}

export default () => (
  <TRPCProvider>
    <RootLayout />
  </TRPCProvider>
);
