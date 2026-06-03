import { Redirect } from "expo-router";
import { useMockSetup } from "~/mock-app/hooks";

export function InitialRedirect() {
  const { getRequiredSetupPath } = useMockSetup();

  return <Redirect href={getRequiredSetupPath() ?? "/(main)"} />;
}
