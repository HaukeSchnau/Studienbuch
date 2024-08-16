import type { SharedValue } from "react-native-reanimated";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

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
          fontFamily: "Nunito_400Regular",
          position: "absolute",
          left: 6 * 4,
          transform: [{ translateY: -10 }],
          pointerEvents: "none",
        },
        animatedStyle,
      ]}
    >
      {label}
    </Animated.Text>
  );
};
