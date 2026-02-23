import { useReactNavigationDevTools } from "@dev-plugins/react-navigation";
import type { NavigationContainerRef, ParamListBase } from "@react-navigation/native";
import { registerDevMenuItems } from "expo-dev-client";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { router, useNavigationContainerRef } from "expo-router";
import type { RefObject } from "react";
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
  useReactNavigationDevTools(navigationRef as unknown as RefObject<NavigationContainerRef<ParamListBase>>);

  return null;
};
