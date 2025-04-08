import { registerDevMenuItems } from "expo-dev-client";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin/";
import { router, useNavigationContainerRef } from "expo-router";
import { useReactNavigationDevTools } from "@dev-plugins/react-navigation";
import { useReactQueryDevTools } from "@dev-plugins/react-query";
import { useQueryClient } from "@tanstack/react-query";

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
  const navigationRef = useNavigationContainerRef();
  const queryClient = useQueryClient();

  useReactNavigationDevTools(navigationRef);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- For some reason, this plugin is not typed
  useDrizzleStudio(expoDb);
  useReactQueryDevTools(queryClient);

  return null;
};
