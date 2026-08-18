import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { fontNames } from "~/components/ui/text";
import { colors } from "~/theme/colors";

type StackScreenOptions = NonNullable<ComponentProps<typeof Stack>["screenOptions"]>;

export const appStackScreenOptions = {
  headerStyle: {
    backgroundColor: colors.primary.DEFAULT,
  },
  headerTintColor: colors.on.primary,
  headerTitleStyle: {
    color: colors.on.primary,
    fontFamily: fontNames.bold,
  },
  headerBackTitle: "Zurück",
  headerBackButtonDisplayMode: "minimal",
  contentStyle: {
    backgroundColor: colors.surface,
  },
} satisfies StackScreenOptions;
