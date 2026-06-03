import { Redirect } from "expo-router";
import { useMockApp } from "~/mock-app/provider";

export function InitialRedirect() {
  const { getRequiredSetupPath } = useMockApp();

  return <Redirect href={getRequiredSetupPath() ?? "/(main)"} />;
}
