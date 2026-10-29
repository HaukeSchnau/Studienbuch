import { Stack } from "expo-router";
import { Suspense } from "react";

import { DeviceGate } from "../infra/device/DeviceGate.tsx";
import { AppTheme } from "../ui/AppTheme.tsx";

export default function RootLayout() {
  return (
    <AppTheme>
      <Suspense fallback={null}>
        <DeviceGate>
          <Stack screenOptions={{ headerShown: false }} />
        </DeviceGate>
      </Suspense>
    </AppTheme>
  );
}
