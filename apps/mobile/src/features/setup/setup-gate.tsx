import type { PropsWithChildren } from "react";
import { Redirect, usePathname, useSegments } from "expo-router";
import { getSetupGateRedirect } from "./setup-gate-policy";
import { useRequiredSetupPath } from "./use-required-setup-path";

export function SetupGate({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const segments = useSegments();
  const requiredSetupPath = useRequiredSetupPath();
  const isSetupRoute = segments[0] === "setup";
  const redirectPath = getSetupGateRedirect({ isSetupRoute, pathname, requiredSetupPath });

  if (redirectPath) {
    return <Redirect href={redirectPath} />;
  }

  return children;
}
