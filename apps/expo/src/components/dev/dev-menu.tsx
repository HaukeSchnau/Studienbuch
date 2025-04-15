import { registerDevMenuItems } from "expo-dev-client";
import { router } from "expo-router";

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

  // useDrizzleStudio(expoDb);
  // useReactQueryDevTools(queryClient);

  return null;
};
