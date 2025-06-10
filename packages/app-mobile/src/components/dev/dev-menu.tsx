import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";
import { expoDb } from "~/db/client";
import { useSQLiteDevTools } from "expo-sqlite-devtools";

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
  // const navigationRef = useNavigationContainerRef();
  // const queryClient = useQueryClient();

  // useReactNavigationDevTools(navigationRef);

  useSQLiteDevTools(expoDb);

  // useDrizzleStudio(expoDb);
  // useReactQueryDevTools(queryClient);

  return null;
};
