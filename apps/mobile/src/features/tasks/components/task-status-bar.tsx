import { useEffect } from "react";
import { Platform, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { PressableSurface } from "~/ui/feedback/pressable-surface";
import { TextButton } from "~/ui/button";
import { SystemIcon } from "~/ui/system-icon";
import { Text } from "~/ui/text";
import { colors } from "~/ui/colors";

const bottomBarShadow = {
  shadowColor: "#000000",
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
};

const burstParticles = [
  { color: colors.primary.DEFAULT, size: 10, x: -82, y: -36 },
  { color: colors.accent.DEFAULT, size: 8, x: -52, y: -58 },
  { color: colors.alert.DEFAULT, size: 9, x: -18, y: -72 },
  { color: colors.primary.punch, size: 12, x: 22, y: -68 },
  { color: colors.accent.pale, size: 8, x: 56, y: -50 },
  { color: colors.alert.DEFAULT, size: 7, x: 84, y: -30 },
] as const;

const BurstParticle = ({
  particle,
  progress,
}: {
  particle: (typeof burstParticles)[number];
  progress: SharedValue<number>;
}) => {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.16, 0.78, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, particle.x]) },
      { translateY: interpolate(progress.value, [0, 1], [0, particle.y]) },
      { scale: interpolate(progress.value, [0, 0.22, 1], [0.25, 1, 0.65]) },
    ],
  }));

  return (
    <Animated.View
      className="absolute rounded-full"
      style={[
        animatedStyle,
        {
          backgroundColor: particle.color,
          height: particle.size,
          left: "50%",
          marginLeft: -particle.size / 2,
          top: 48,
          width: particle.size,
        },
      ]}
    />
  );
};

const CompletionBurst = () => {
  const progress = useSharedValue(0);
  const centerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14, 0.68, 1], [0, 1, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [8, -30]) },
      { scale: interpolate(progress.value, [0, 0.18, 1], [0.7, 1, 0.9]) },
    ],
  }));

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 760,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  return (
    <View
      pointerEvents="none"
      className="absolute inset-x-0 items-center"
      style={{
        bottom: Platform.OS === "ios" ? 126 : 118,
        elevation: 3,
        height: 100,
        zIndex: 3,
      }}
    >
      {burstParticles.map((particle) => (
        <BurstParticle
          key={`${particle.x}-${particle.y}`}
          particle={particle}
          progress={progress}
        />
      ))}
      <Animated.View
        className="absolute h-12 w-12 items-center justify-center rounded-full bg-white"
        style={[
          centerStyle,
          {
            left: "50%",
            marginLeft: -24,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
            top: 28,
          },
        ]}
      >
        <SystemIcon name="check" color={colors.primary.text} size={26} />
      </Animated.View>
    </View>
  );
};

export const TaskStatusBar = ({
  done,
  dueLabel,
  bottomInset,
  completionBurstKey,
  onToggleDone,
}: {
  done: boolean;
  dueLabel: string | undefined;
  bottomInset: number;
  completionBurstKey: number;
  onToggleDone: () => void;
}) => (
  <>
    {completionBurstKey > 0 ? <CompletionBurst key={completionBurstKey} /> : null}

    <View
      className="absolute inset-x-0 bottom-0 border-t border-[#E5E7EB] bg-white px-5 pt-3"
      style={[bottomBarShadow, { paddingBottom: bottomInset + (Platform.OS === "ios" ? 10 : 12) }]}
    >
      {done ? (
        <View className="rounded-[24px] bg-primary-des px-3 py-3">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
              <SystemIcon name="check" color={colors.primary.text} size={24} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[17px] text-primary-text" weight="bold">
                Erledigt
              </Text>
              <Text className="text-sm text-[#52616F]">Gut abgehakt. {dueLabel}</Text>
            </View>
            <TextButton label="Zurücknehmen" onPress={onToggleDone} size="sm" />
          </View>
        </View>
      ) : (
        <View>
          <View className="flex-row items-center justify-between">
            <View className="min-w-0 flex-1 pr-4">
              <Text className="text-[15px] text-[#6B7280]">Status</Text>
              <Text className="text-[18px] text-[#172033]" weight="bold">
                Noch offen
              </Text>
            </View>
            <Text className="text-[15px] text-[#6B7280]" numberOfLines={1}>
              {dueLabel}
            </Text>
          </View>
          <PressableSurface
            accessibilityLabel="Aufgabe als erledigt markieren"
            borderRadius={24}
            className="mt-2.5 h-12 flex-row items-center justify-center gap-2 rounded-full bg-accent"
            haptic="impact"
            onPress={onToggleDone}
            pressedScale={0.985}
          >
            <SystemIcon name="check" color={colors.on.primary} size={21} />
            <Text className="text-[17px] text-white" weight="semi-bold">
              Als erledigt markieren
            </Text>
          </PressableSurface>
        </View>
      )}
    </View>
  </>
);
