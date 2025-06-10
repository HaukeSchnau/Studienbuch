import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { fontNames } from "./text";

interface Props {
  label: string;
  active: SharedValue<boolean>;
  focused: SharedValue<boolean>;
}

export const FieldLabel = ({ label, active, focused }: Props) => {
  const animatedStyle = useAnimatedStyle(() => ({
    color: withTiming(focused.value ? "#1E8A00" : "#666666"),
    top: withTiming(active.value ? "0%" : "50%"),
  }));

  return (
    <Animated.Text
      style={[
        {
          fontFamily: fontNames.regular,
          position: "absolute",
          left: 20,
          top: 0,
          // transform: [{ translateY:  }],
          pointerEvents: "none",
        },
        animatedStyle,
      ]}
    >
      {label}
    </Animated.Text>
  );
};
