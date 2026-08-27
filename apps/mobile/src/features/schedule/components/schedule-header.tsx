import { format, isToday } from "date-fns";
import { de as localeDE } from "date-fns/locale/de";
import { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";

import { IconButton } from "~/ui/icon-button";
import { shadow } from "~/ui/styles/shadow";
import { Text } from "~/ui/text";
import { colors } from "~/ui/colors";

export type ScheduleHeaderPage = {
  relativeOffset: number;
  weekStart: Date;
  weekdays: readonly Date[];
};

export const ScheduleHeader = ({
  currentWeek,
  pages,
  gridWidth,
  timeRailWidth,
  weekdayLabels,
  weekDragX,
  onChangeWeek,
}: {
  currentWeek: number;
  pages: readonly ScheduleHeaderPage[];
  gridWidth: number;
  timeRailWidth: number;
  weekdayLabels: readonly string[];
  weekDragX: SharedValue<number>;
  onChangeWeek: (delta: number) => void;
}) => {
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: weekDragX.value }],
  }));

  return (
    <View style={[shadow, { backgroundColor: colors.primary.DEFAULT }]}>
      <SafeAreaView edges={["top"]}>
        <View className="px-4 pb-2 pt-1">
          <View className="flex-row items-center">
            <IconButton
              accessibilityLabel="Vorherige Woche"
              icon="chevron-left"
              variant="plain"
              color="white"
              onPress={() => onChangeWeek(-1)}
            />
            <View className="flex-1 items-center">
              <Text weight="bold" className="text-center text-lg text-white">
                KW {currentWeek}
              </Text>
            </View>
            <IconButton
              accessibilityLabel="Nächste Woche"
              icon="chevron-right"
              variant="plain"
              color="white"
              onPress={() => onChangeWeek(1)}
            />
          </View>
          <View className="flex-row">
            <View style={{ width: timeRailWidth }} />
            <View className="h-12 flex-1 overflow-hidden">
              <Animated.View className="absolute inset-0" style={contentStyle}>
                {pages.map((page) => (
                  <View
                    key={`header-${page.weekStart.toISOString()}`}
                    accessibilityElementsHidden={page.relativeOffset !== 0}
                    className="absolute bottom-0 top-0 flex-row"
                    importantForAccessibility={
                      page.relativeOffset === 0 ? "auto" : "no-hide-descendants"
                    }
                    style={{
                      width: gridWidth,
                      transform: [{ translateX: page.relativeOffset * gridWidth }],
                    }}
                  >
                    {page.weekdays.map((day, index) => (
                      <View key={day.toISOString()} className="flex-1 items-center justify-center">
                        <Text
                          weight="bold"
                          className="text-sm uppercase text-white/85"
                          style={{
                            color: isToday(day) ? "#FFFFFF" : "rgba(255, 255, 255, 0.82)",
                          }}
                        >
                          {weekdayLabels[index]}
                        </Text>
                        <Text
                          weight={isToday(day) ? "bold" : "semi-bold"}
                          className="text-base text-white"
                        >
                          {format(day, "dd.MM.", { locale: localeDE })}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </Animated.View>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};
