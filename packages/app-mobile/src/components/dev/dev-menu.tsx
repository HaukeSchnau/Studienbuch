import { useReactNavigationDevTools } from "@dev-plugins/react-navigation";
import { registerDevMenuItems } from "expo-dev-client";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { router, useNavigationContainerRef } from "expo-router";
import { expoDb } from "~/db/client";

void registerDevMenuItems([
  {
    name: "Sitemap",
    shouldCollapse: true,
    callback: () => {
      router.navigate("/_sitemap");
    },
  },
]);

export const DevTools = () => {
  useDrizzleStudio(expoDb);

  const navigationRef = useNavigationContainerRef();
  useReactNavigationDevTools(navigationRef as any);

  return null;
};
