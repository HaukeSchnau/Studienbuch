import type { PropsWithChildren } from "react";
import { Redirect, useSegments } from "expo-router";
import { useMockApp } from "~/mock-app/provider";

export function SetupGate({ children }: PropsWithChildren) {
  const segments = useSegments();
  const { getRequiredSetupPath } = useMockApp();
  const requiredSetupPath = getRequiredSetupPath();
  const isSetupRoute = segments[0] === "setup";

  if (requiredSetupPath && !isSetupRoute) {
    return <Redirect href={requiredSetupPath} />;
  }

  return children;
}
