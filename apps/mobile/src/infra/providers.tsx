import type { PropsWithChildren } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ReanimatedScreenProvider } from "react-native-screens/reanimated";
import { StatusBar } from "expo-status-bar";
import { AppDataProvider } from "~/infra/data/app-data-provider";
import { StudienbuchWidgetPublisher } from "~/features/widgets/studienbuch-widget-publisher";
import { MobileTelemetryProvider } from "~/infra/observability/mobile-telemetry-provider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <MobileTelemetryProvider>
      <AppDataProvider>
        <StudienbuchWidgetPublisher />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ReanimatedScreenProvider>
              <StatusBar style="light" />
              {children}
            </ReanimatedScreenProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </AppDataProvider>
    </MobileTelemetryProvider>
  );
}
