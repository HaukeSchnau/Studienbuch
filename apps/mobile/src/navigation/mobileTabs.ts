import type { NativeTabsTriggerIconProps } from "expo-router/unstable-native-tabs";

export const mobileTabs = [
  {
    name: "index",
    label: "Home",
    icon: {
      sf: {
        default: "square.grid.2x2",
        selected: "square.grid.2x2.fill",
      },
      md: {
        default: "dashboard",
        selected: "dashboard",
      },
    },
  },
] as const satisfies ReadonlyArray<{
  name: string;
  label: string;
  icon: NativeTabsTriggerIconProps;
}>;
