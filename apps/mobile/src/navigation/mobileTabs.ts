import type { NativeTabsTriggerIconProps } from "expo-router/unstable-native-tabs";

export const mobileTabs = [
  {
    name: "index",
    label: "Today",
    icon: {
      sf: {
        default: "calendar",
        selected: "calendar",
      },
      md: {
        default: "calendar_month",
        selected: "calendar_month",
      },
    },
  },
  {
    name: "classes",
    label: "Classes",
    icon: {
      sf: {
        default: "books.vertical",
        selected: "books.vertical.fill",
      },
      md: {
        default: "school",
        selected: "school",
      },
    },
  },
  {
    name: "tasks",
    label: "Tasks",
    icon: {
      sf: {
        default: "checklist",
        selected: "checklist",
      },
      md: {
        default: "checklist",
        selected: "checklist",
      },
    },
  },
  {
    name: "settings",
    label: "Settings",
    icon: {
      sf: {
        default: "gearshape",
        selected: "gearshape.fill",
      },
      md: {
        default: "settings",
        selected: "settings",
      },
    },
  },
] as const satisfies ReadonlyArray<{
  name: string;
  label: string;
  icon: NativeTabsTriggerIconProps;
}>;
