import { Platform } from "react-native";

import { colors } from "~/theme/colors";

export const nativeHostThemeProps = (seedColor: string = colors.primary.DEFAULT) =>
  Platform.OS === "android" ? { seedColor } : {};
