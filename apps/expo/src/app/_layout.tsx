import "@bacons/text-decoder/install";

import { Stack } from "expo-router";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import * as SplashScreen from "expo-splash-screen";
import {
  Nunito_400Regular,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";

import { DevMenu } from "~/components/dev/dev-menu";
import { PortalRenderer, usePortalStore } from "~/components/portal";
import { db, expoDb } from "~/db/client";
import migrations from "../../drizzle/migrations";

void SplashScreen.preventAutoHideAsync();

if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RootLayout() {
  const { success: migrationSuccess, error: migrationError } = useMigrations(
    db,
    migrations,
  );
  useDrizzleStudio(expoDb);

  const [fontLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_700Bold,
  });

  const isLoaded =
    (fontLoaded || !!fontError) && (migrationSuccess || !!migrationError);

  useEffect(() => {
    if (isLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return null;
  }

  return (
    <Providers>
      <GestureHandlerRootView>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "#33A42B",
            },
            headerTitleStyle: {
              color: "#FFFFFF",
            },
            contentStyle: {
              backgroundColor: "#FFFFFF",
            },
          }}
        >
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
        </Stack>

        <DevMenu />

        <PortalRenderer />
      </GestureHandlerRootView>
    </Providers>
  );
}

const Providers = ({ children }: { children: ReactNode }) => {
  return <TRPCProvider>{children}</TRPCProvider>;
};
