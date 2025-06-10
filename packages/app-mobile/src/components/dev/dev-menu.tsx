import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { expoDb } from "~/db/client";
import useSQLiteDevTools from "expo-sqlite-devtools/build/useSQLiteDevTools";

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
  useSQLiteDevTools(expoDb);
  return null;
};
