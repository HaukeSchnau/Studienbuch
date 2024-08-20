import "@bacons/text-decoder/install";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { TRPCProvider } from "~/utils/api";

import "./styles.css";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { UIManager } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import {
  Nunito_400Regular,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";

void SplashScreen.preventAutoHideAsync();

if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Nunito_400Regular,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <Providers>
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
      />
      <StatusBar />
    </Providers>
  );
}

const Providers = ({ children }: { children: ReactNode }) => {
  return <TRPCProvider>{children}</TRPCProvider>;
};
