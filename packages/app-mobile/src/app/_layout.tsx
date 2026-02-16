import { Stack } from "expo-router";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import { colors } from "@stu/tailwind-config/native";
import { setDefaultOptions } from "date-fns";
import { de } from "date-fns/locale";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import * as Network from "expo-network";
import * as SplashScreen from "expo-splash-screen";
import { lazy, useCallback, useEffect, useRef, useState } from "react";
import { AppState, UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PortalRenderer } from "~/components/portal";
import { db } from "~/db/client";
import { useSessionWatcher } from "~/utils/auth";
import { SyncEngineProvider } from "~/utils/events/ingest";
import { type AppRuntime, makeRuntime, RuntimeContext } from "~/utils/groundswell";
import { MissingInfoGuard } from "~/utils/missing-info-guard";
import { getStorage } from "~/utils/storage";
import { createSyncLifecycleRefreshController, resolveNetworkOnline } from "~/utils/sync-lifecycle";
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
  const [runtime, setRuntime] = useState<AppRuntime | null>(null);
  const runtimeRef = useRef<AppRuntime | null>(null);

  const isLoaded = (migrationSuccess || !!migrationError) && !sessionLoading;

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hide();
    }
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) {
      setRuntime((previousRuntime) => {
        if (previousRuntime) {
          void previousRuntime.dispose();
        }
        runtimeRef.current = null;
        return null;
      });
    }
  }, [isLoaded]);

  const refreshRuntime = useCallback(() => {
    const offset = getStorage("sync.offset") ?? 0;
    const nextRuntime = makeRuntime(offset);

    setRuntime((previousRuntime) => {
      if (previousRuntime) {
        void previousRuntime.dispose();
      }
      runtimeRef.current = nextRuntime;
      return nextRuntime;
    });
  }, []);

  useEffect(
    () => () => {
      const activeRuntime = runtimeRef.current;
      runtimeRef.current = null;
      if (activeRuntime) {
        void activeRuntime.dispose();
      }
    },
    [],
  );

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    refreshRuntime();

    const lifecycleController = createSyncLifecycleRefreshController({
      appState: AppState.currentState,
      online: true,
    });

    const appStateSubscription = AppState.addEventListener("change", (next) => {
      if (lifecycleController.onAppStateChange(next)) {
        refreshRuntime();
      }
    });

    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (lifecycleController.onNetworkChange(resolveNetworkOnline(state))) {
        refreshRuntime();
      }
    });

    void Network.getNetworkStateAsync().then((state) => {
      lifecycleController.setNetworkOnline(resolveNetworkOnline(state));
    });

    return () => {
      appStateSubscription.remove();
      networkSubscription.remove();
    };
  }, [isLoaded, refreshRuntime]);

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
