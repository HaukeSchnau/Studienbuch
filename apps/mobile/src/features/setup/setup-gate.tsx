import type { PropsWithChildren } from "react";
import { Redirect, usePathname, useSegments } from "expo-router";
import { useSetupProgress } from "~/infra/data/hooks";
import { getSetupGateRedirect } from "./setup-gate-policy";

export function SetupGate({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const segments = useSegments();
  const { getRequiredSetupPath } = useSetupProgress();
  const requiredSetupPath = getRequiredSetupPath();
  const isSetupRoute = segments[0] === "setup";
  const redirectPath = getSetupGateRedirect({ isSetupRoute, pathname, requiredSetupPath });

  if (redirectPath) {
    return <Redirect href={redirectPath} />;
  }

  return children;
}
