import { Suspense } from "react";

import { DeviceGate } from "../infra/device/DeviceGate.tsx";
import { AppTheme } from "../ui/AppTheme.tsx";
import { AppTabs } from "../ui/navigation/AppTabs.tsx";

export default function RootLayout() {
  return (
    <AppTheme>
      <Suspense fallback={null}>
        <DeviceGate>
          <AppTabs />
        </DeviceGate>
      </Suspense>
    </AppTheme>
  );
}
