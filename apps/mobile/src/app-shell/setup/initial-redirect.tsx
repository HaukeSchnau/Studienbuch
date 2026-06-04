import { Redirect } from "expo-router";
import { useSetupProgress } from "~/data/hooks";

export function InitialRedirect() {
  const { getRequiredSetupPath } = useSetupProgress();

  return <Redirect href={getRequiredSetupPath() ?? "/(main)"} />;
}
