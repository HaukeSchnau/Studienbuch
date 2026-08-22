import type { PropsWithChildren } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ReanimatedScreenProvider } from "react-native-screens/reanimated";
import { StatusBar } from "expo-status-bar";
import { StudienbuchWidgetPublisher } from "~/features/widgets/studienbuch-widget-publisher";
import { EffectAtomProvider } from "~/infra/effect-atom/provider";
import { MobileTelemetryProvider } from "~/infra/observability/mobile-telemetry-provider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <MobileTelemetryProvider>
      <EffectAtomProvider>
        <StudienbuchWidgetPublisher />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <ReanimatedScreenProvider>
              <StatusBar style="light" />
              {children}
            </ReanimatedScreenProvider>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </EffectAtomProvider>
    </MobileTelemetryProvider>
  );
}
