import type { SetupPath } from "@/compat/mobile-v0";
import type { Href } from "expo-router";
import { mainProfileRoute } from "../../routing/params";

export const getSetupGateRedirect = ({
  isSetupRoute,
  pathname,
  requiredSetupPath,
}: {
  isSetupRoute: boolean;
  pathname: string;
  requiredSetupPath: SetupPath | null;
}): Href | null => {
  if (requiredSetupPath && pathname !== requiredSetupPath) {
    return requiredSetupPath;
  }

  if (!requiredSetupPath && isSetupRoute) {
    return mainProfileRoute;
  }

  return null;
};
