import type { PropsWithChildren } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ReanimatedScreenProvider } from "react-native-screens/reanimated";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "~/data/app-data-provider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppDataProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ReanimatedScreenProvider>
            <StatusBar style="light" />
            {children}
          </ReanimatedScreenProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppDataProvider>
  );
}
