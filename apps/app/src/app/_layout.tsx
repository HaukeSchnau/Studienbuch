import { Stack } from "expo-router";
import { Suspense } from "react";

import { ForgetWhenDeleted } from "../features/account/AccountGates.tsx";
import { DeviceGate } from "../infra/device/DeviceGate.tsx";
import { AppTheme } from "../ui/AppTheme.tsx";

export default function RootLayout() {
  return (
    <AppTheme>
      <Suspense fallback={null}>
        <DeviceGate>
          <ForgetWhenDeleted />
          <Stack screenOptions={{ headerShown: false }} />
        </DeviceGate>
      </Suspense>
    </AppTheme>
  );
}
