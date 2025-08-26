import { Stack } from "expo-router";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import { colors } from "@stu/tailwind-config/native";
import { setDefaultOptions } from "date-fns";
import { de } from "date-fns/locale";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import * as SplashScreen from "expo-splash-screen";
import { lazy, useEffect, useMemo } from "react";
import { UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PortalRenderer } from "~/components/portal";
import { db } from "~/db/client";
import { useSessionWatcher } from "~/utils/auth";
import { SyncEngineProvider } from "~/utils/events/ingest";
import { makeRuntime, RuntimeContext } from "~/utils/groundswell";
import { MissingInfoGuard } from "~/utils/missing-info-guard";
import { getStorage } from "~/utils/storage";
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

setDefaultOptions({ locale: de });

function RootLayout() {
  const { success: migrationSuccess, error: migrationError } = useMigrations(db, migrations);

  const sessionLoading = useSessionWatcher();

  const isLoaded = (migrationSuccess || !!migrationError) && !sessionLoading;

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hide();
    }
  }, [isLoaded]);

  const runtime = useMemo(() => {
    if (!isLoaded) return null;

    const offset = getStorage("sync.offset") ?? 0;
    return makeRuntime(offset);
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <RuntimeContext.Provider value={runtime}>
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
    </RuntimeContext.Provider>
  );
}

export default () => (
  <TRPCProvider>
    <RootLayout />
  </TRPCProvider>
);
