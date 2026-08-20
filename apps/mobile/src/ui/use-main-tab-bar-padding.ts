import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAIN_TAB_BAR_OVERLAY = Platform.select({
  ios: 88,
  android: 72,
  default: 0,
});

export const useMainTabBarPadding = (extra = 0) => {
  const insets = useSafeAreaInsets();

  return insets.bottom + MAIN_TAB_BAR_OVERLAY + extra;
};
