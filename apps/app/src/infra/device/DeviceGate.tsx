import type { ReactNode } from "react";

/** A phone has one database and no tabs, so nothing waits here. `DeviceGate.web.tsx` is the browser's. */
export function DeviceGate({ children }: { readonly children: ReactNode }) {
  return children;
}
