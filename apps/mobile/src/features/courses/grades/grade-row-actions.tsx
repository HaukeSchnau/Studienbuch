import { TouchableOpacity, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { SystemIcon, type SystemIconName } from "~/components/system-icon";
import { Text } from "~/components/text";
import { colors } from "~/theme/colors";

interface ActionProps {
  icon: SystemIconName;
  label: string;
  color: string;
  onPress: () => void;
}

const SwipeAction = ({ icon, label, color, onPress }: ActionProps) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    className="h-full min-w-24 items-center justify-center px-3"
    style={{ backgroundColor: color }}
  >
    <SystemIcon name={icon} color="white" size={18} />
    <View className="h-1.5" />
    <Text weight="bold" className="text-center text-sm text-white">
      {label}
    </Text>
  </TouchableOpacity>
);

export const GradeRowActions = ({
  progress,
  primary,
  secondary,
}: {
  progress: SharedValue<number>;
  primary: ActionProps;
  secondary?: ActionProps;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.35, 1]),
    transform: [{ translateX: interpolate(progress.value, [0, 1], [36, 0]) }],
  }));

  return (
    <Animated.View style={animatedStyle} className="h-full flex-row items-stretch pl-3">
      {secondary ? <SwipeAction {...secondary} /> : null}
      <SwipeAction {...primary} color={primary.color ?? colors.accent.DEFAULT} />
    </Animated.View>
  );
};
