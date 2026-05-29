import { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReanimatedHeaderHeight } from "react-native-screens/reanimated";

export const useTransparentHeaderTopPadding = () => {
  const insets = useSafeAreaInsets();
  const headerHeight = useReanimatedHeaderHeight();

  return useAnimatedStyle(
    () => ({
      paddingTop: Math.max(headerHeight.value - insets.top, 0),
    }),
    [headerHeight, insets.top],
  );
};
