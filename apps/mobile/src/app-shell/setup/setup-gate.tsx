import type { PropsWithChildren } from "react";
import { Redirect, useSegments } from "expo-router";
import { useSetupProgress } from "~/data/hooks";

export function SetupGate({ children }: PropsWithChildren) {
  const segments = useSegments();
  const { getRequiredSetupPath } = useSetupProgress();
  const requiredSetupPath = getRequiredSetupPath();
  const isSetupRoute = segments[0] === "setup";

  if (requiredSetupPath && !isSetupRoute) {
    return <Redirect href={requiredSetupPath} />;
  }

  return children;
}
