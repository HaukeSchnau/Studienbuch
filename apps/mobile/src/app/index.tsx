import { Redirect } from "expo-router";
import { useMockApp } from "~/mock-app/provider";

export default function Index() {
  const { getRequiredSetupPath } = useMockApp();
  return <Redirect href={getRequiredSetupPath() ?? "/(main)"} />;
}
