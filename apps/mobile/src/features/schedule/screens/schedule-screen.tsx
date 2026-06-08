import {
  addMinutes,
  addDays,
  addWeeks,
  format,
  getDay,
  getISOWeek,
  isToday,
  startOfISOWeek,
  subMilliseconds,
} from "date-fns";
import { de as localeDE } from "date-fns/locale/de";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Platform, type DimensionValue, View } from "react-native";
import { Directions, Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { Card } from "~/components/ui/card";
import { IconButton } from "~/components/ui/icon-button";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { shadow } from "~/components/styles/shadow";
import { Text } from "~/components/ui/text";
import { useMainTabBarPadding } from "~/components/use-main-tab-bar-padding";
import { haptics } from "~/platform/haptics";
import { subjectNameMap, type SubjectId } from "@stu/core";
import { useCourses, useScheduleData } from "~/data/hooks";
import { courseRoute } from "~/routing/params";
import { colors } from "~/theme/colors";

const TIME_MARKERS = [
  { minute: 8 * 60, label: "08:00" },
  { minute: 9 * 60 + 20, label: "09:20" },
  { minute: 9 * 60 + 45, label: "09:45" },
  { minute: 11 * 60 + 5, label: "11:05" },
  { minute: 11 * 60 + 30, label: "11:30" },
  { minute: 12 * 60 + 50, label: "12:50" },
  { minute: 13 * 60 + 50, label: "13:50" },
  { minute: 15 * 60 + 10, label: "15:10" },
];
const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr"];
const DAY_START = 8 * 60;
const DAY_END = 15 * 60 + 10;
const DAY_DURATION = DAY_END - DAY_START;
const GRID_FALLBACK_HEIGHT = 500;
const TIME_RAIL_WIDTH = 44;
const ENTRY_COLUMN_GAP = 4;
const timetableSubjectLabelMap: Partial<Record<SubjectId, string>> = {
  bi: "Bio",
  ch: "Chemie",
  de: "Deutsch",
  ds: "DS",
  en: "Englisch",
  fr: "Franz.",
  ge: "Gesch.",
  if: "Info",
  ku: "Kunst",
  la: "Latein",
  ma: "Mathe",
  mu: "Musik",
  ph: "Physik",
  pw: "Politik",
  re: "Reli",
  sf: "Seminar",
  sn: "Span.",
  sp: "Sport",
  "sport-theorie": "Sport-Th.",
  tutorium: "Tutorium",
  wn: "Werte",
};

const timeToPosition = (minute: number, gridHeight: number) =>
  ((minute - DAY_START) / DAY_DURATION) * gridHeight;
const durationToHeight = (duration: number, gridHeight: number) =>
  (duration / DAY_DURATION) * gridHeight;
const weekdayToPercent = (weekday: number) =>
  `${(weekday / WEEKDAY_LABELS.length) * 100}%` as DimensionValue;

export const ScheduleScreen = () => {
  const { getCourse } = useCourses();
  const { timetable } = useScheduleData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  const bottomClearance = useMainTabBarPadding(12);
  const weekBottomClearance =
    Platform.OS === "ios" ? Math.max(bottomClearance - 72, 56) : bottomClearance;
  const resolvedGridHeight = gridHeight || GRID_FALLBACK_HEIGHT;

  const changeWeek = useCallback((delta: number) => {
    haptics.selection();
    setWeekOffset((current) => current + delta);
  }, []);

  const swipeGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Native(),
        Gesture.Exclusive(
          Gesture.Fling()
            .direction(Directions.LEFT)
            .numberOfPointers(1)
            .onEnd(() => {
              runOnJS(changeWeek)(1);
            }),
          Gesture.Fling()
            .direction(Directions.RIGHT)
            .numberOfPointers(1)
            .onEnd(() => {
              runOnJS(changeWeek)(-1);
            }),
        ),
      ),
    [changeWeek],
  );

  const weekStart = useMemo(() => addWeeks(startOfISOWeek(new Date()), weekOffset), [weekOffset]);
  const weekEnd = useMemo(() => subMilliseconds(addDays(weekStart, 5), 1), [weekStart]);
  const weekdays = useMemo(
    () => WEEKDAY_LABELS.map((_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const visibleEntries = useMemo(
    () =>
      timetable
        .map((entry) => ({
          ...entry,
          weekday: (getDay(entry.start) + 6) % 7,
          startMinutes: entry.start.getHours() * 60 + entry.start.getMinutes(),
        }))
        .filter(
          (entry) =>
            entry.weekday < WEEKDAY_LABELS.length &&
            entry.start.getTime() >= weekStart.getTime() &&
            entry.start.getTime() <= weekEnd.getTime(),
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [timetable, weekEnd, weekStart],
  );

  const currentWeek = getISOWeek(weekStart);
  const now = new Date();
  const nowWeekday = (getDay(now) + 6) % 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowMarker =
    weekOffset === 0 &&
    nowWeekday >= 0 &&
    nowWeekday < WEEKDAY_LABELS.length &&
    nowMinutes >= DAY_START &&
    nowMinutes <= DAY_END;

  return (
    <View className="flex-1 overflow-hidden bg-[#F7F8FB]">
      <View style={[shadow, { backgroundColor: colors.primary.DEFAULT }]}>
        <SafeAreaView edges={["top"]}>
          <View className="px-4 pb-2 pt-1">
            <View className="flex-row items-center">
              <IconButton
                accessibilityLabel="Vorherige Woche"
                icon="chevron-left"
                variant="plain"
                color="white"
                onPress={() => changeWeek(-1)}
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
                onPress={() => changeWeek(1)}
              />
            </View>
            <View className="flex-row">
              <View style={{ width: TIME_RAIL_WIDTH }} />
              <View className="flex-1 flex-row">
                {weekdays.map((day, index) => (
                  <View key={day.toISOString()} className="flex-1 items-center">
                    <Text
                      weight="bold"
                      className="text-sm uppercase text-white/85"
                      style={{
                        color: isToday(day) ? "#FFFFFF" : "rgba(255, 255, 255, 0.82)",
                      }}
                    >
                      {WEEKDAY_LABELS[index]}
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
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View className="flex-1 px-4 pt-3" style={{ paddingBottom: weekBottomClearance }}>
        <View
          className="min-h-0 flex-1 flex-row items-stretch"
          onLayout={({ nativeEvent }) => {
            const nextHeight = nativeEvent.layout.height;
            if (nextHeight > 0 && Math.abs(nextHeight - gridHeight) > 1) {
              setGridHeight(nextHeight);
            }
          }}
        >
          <View className="self-stretch" style={{ width: TIME_RAIL_WIDTH }}>
            {TIME_MARKERS.map((marker) => (
              <Text
                key={marker.minute}
                className="absolute right-1 text-[13px] text-neutral"
                style={{
                  top: Math.max(4, timeToPosition(marker.minute, resolvedGridHeight) - 8),
                }}
              >
                {marker.label}
              </Text>
            ))}
          </View>

          <View className="min-h-0 flex-1">
            <Card
              padding="none"
              radius="sm"
              className="relative flex-1 overflow-hidden"
              style={{ flex: 1 }}
            >
              <GestureDetector gesture={swipeGesture}>
                <View className="absolute inset-0">
                  {weekdays.map((day, index) => (
                    <View
                      key={`day-bg-${day.toISOString()}`}
                      className="absolute top-0 bottom-0"
                      style={{
                        left: weekdayToPercent(index),
                        width: `${100 / WEEKDAY_LABELS.length}%`,
                        backgroundColor: isToday(day) ? "rgba(59, 127, 217, 0.08)" : "transparent",
                      }}
                    />
                  ))}

                  {weekdays.slice(1).map((day, index) => (
                    <View
                      key={`divider-${day.toISOString()}`}
                      className="absolute top-0 bottom-0 w-px bg-[#E8EEF8]"
                      style={{ left: weekdayToPercent(index + 1) }}
                    />
                  ))}

                  {TIME_MARKERS.map((marker) => (
                    <View
                      key={`tick-${marker.minute}`}
                      className="absolute right-0 left-0 bg-[#E6EBF2]"
                      style={{
                        top: timeToPosition(marker.minute, resolvedGridHeight),
                        height: 1,
                      }}
                    />
                  ))}

                  {showNowMarker ? (
                    <>
                      <View
                        className="absolute z-10 h-2 w-2 rounded-full bg-[#E54F64]"
                        style={{
                          top: timeToPosition(nowMinutes, resolvedGridHeight),
                          left: weekdayToPercent(nowWeekday),
                          marginTop: -4,
                          marginLeft: -4,
                        }}
                      />
                      <View
                        className="absolute right-0 z-10 h-px bg-[#E54F64]"
                        style={{
                          top: timeToPosition(nowMinutes, resolvedGridHeight),
                          left: weekdayToPercent(nowWeekday),
                        }}
                      />
                    </>
                  ) : null}
                </View>
              </GestureDetector>

              {visibleEntries.map((entry) => {
                const course = getCourse(entry.courseId);
                if (!course) return null;

                const end = addMinutes(entry.start, entry.duration);
                const timetableLabel =
                  timetableSubjectLabelMap[course.subject] ?? subjectNameMap[course.subject];

                return (
                  <View
                    key={entry.id}
                    pointerEvents="box-none"
                    style={{
                      position: "absolute",
                      top: timeToPosition(entry.startMinutes, resolvedGridHeight),
                      left: weekdayToPercent(entry.weekday),
                      width: `${100 / WEEKDAY_LABELS.length}%`,
                      height: durationToHeight(entry.duration, resolvedGridHeight),
                      paddingHorizontal: ENTRY_COLUMN_GAP,
                    }}
                  >
                    <PressableSurface
                      onPress={() => {
                        router.push(courseRoute(course.id));
                      }}
                      accessibilityLabel={`${subjectNameMap[course.subject]}, ${format(
                        entry.start,
                        "HH:mm",
                        {
                          locale: localeDE,
                        },
                      )} bis ${format(end, "HH:mm", { locale: localeDE })}`}
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        borderRadius: 24,
                        backgroundColor: colors.accent.DEFAULT,
                      }}
                      borderRadius={24}
                      haptic="impact"
                      highlightColor="rgba(255, 255, 255, 0.18)"
                      pressedScale={0.965}
                    >
                      <View className="items-center justify-center px-1 py-1.5">
                        <View className="rounded-full bg-white p-1">
                          <SubjectIcon subject={course.subject} />
                        </View>
                        <View className="h-1" />
                        <Text
                          weight="bold"
                          className="text-center text-[10px] leading-[14px] text-white"
                          numberOfLines={1}
                        >
                          {timetableLabel}
                        </Text>
                        <Text className="mt-0.5 text-center text-[8px] leading-[9px] text-white/78">
                          {format(entry.start, "HH:mm", { locale: localeDE })}
                          {"\n"}
                          {format(end, "HH:mm", { locale: localeDE })}
                        </Text>
                      </View>
                    </PressableSurface>
                  </View>
                );
              })}

              {visibleEntries.length === 0 ? (
                <View className="absolute inset-0 items-center justify-center">
                  <Text className="text-lg text-neutral">Diese Woche ist noch leer.</Text>
                </View>
              ) : null}
            </Card>
          </View>
        </View>
      </View>
    </View>
  );
};
