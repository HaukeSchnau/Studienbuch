import { useCallback } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type WithTimingConfig,
} from "react-native-reanimated";

const timing: WithTimingConfig = {
  duration: 140,
};

export const usePressAnimation = (pressedScale = 0.96) => {
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withTiming(pressedScale, timing);
  }, [pressedScale, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, timing);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return {
    animatedStyle,
    onPressIn,
    onPressOut,
  };
};
