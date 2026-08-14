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
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { Platform, type DimensionValue, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { PressableSurface } from "~/components/feedback/pressable-surface";
import { Card } from "~/components/ui/card";
import { IconButton } from "~/components/ui/icon-button";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubjectIcon } from "~/domain-ui/subject-icon";
import { SystemIcon } from "~/components/ui/system-icon";
import { shadow } from "~/components/styles/shadow";
import { Text } from "~/components/ui/text";
import { useMainTabBarPadding } from "~/components/use-main-tab-bar-padding";
import { haptics } from "~/platform/haptics";
import { subjectNameMap, type SubjectId } from "@stu/core/compat/mobile-v0";
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
const WEEK_SWIPE_MIN_DISTANCE = 72;
const WEEK_SWIPE_VELOCITY = 760;
const WEEK_PAGE_OFFSETS = [-1, 0, 1] as const;
const timetableSubjectLabelMap = {
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
} as const satisfies Partial<Record<SubjectId, string>>;

const timeToPosition = (minute: number, gridHeight: number) =>
  ((minute - DAY_START) / DAY_DURATION) * gridHeight;
const durationToHeight = (duration: number, gridHeight: number) =>
  (duration / DAY_DURATION) * gridHeight;
const weekdayToPercent = (weekday: number) =>
  `${(weekday / WEEKDAY_LABELS.length) * 100}%` as DimensionValue;

const EmptyWeekState = () => (
  <View
    accessible
    accessibilityLabel="Freie Woche. Keine Kurse eingetragen."
    className="items-center px-5"
    pointerEvents="none"
  >
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className="relative h-28 w-40">
        <View className="absolute left-8 top-4 h-20 w-24 rotate-[-8deg] rounded-[24px] bg-[#EAF7EA]" />
        <View className="absolute left-14 top-1 h-16 w-20 rotate-[8deg] rounded-[20px] bg-[#EAF1FF]" />
        <View className="absolute left-12 top-6 h-16 w-16 items-center justify-center rounded-full bg-white">
          <SystemIcon name="calendar-today" color={colors.primary.DEFAULT} size={30} />
        </View>
        <View className="absolute left-1 top-16 rounded-full bg-[#3B7FD9] px-3 py-1.5">
          <Text weight="bold" className="text-[10px] uppercase text-white">
            frei
          </Text>
        </View>
        <View className="absolute right-2 top-20 rotate-[7deg] rounded-full bg-[#FFD95A] px-3 py-1.5">
          <Text weight="bold" className="text-[10px] text-[#3E4655]">
            :)
          </Text>
        </View>
        <View className="absolute right-8 top-3 h-3 w-3 rounded-full bg-[#2EAB2E]" />
        <View className="absolute right-1 top-10 h-2 w-2 rounded-full bg-[#3B7FD9]" />
      </View>
      <View className="items-center">
        <Text weight="bold" className="mt-1 text-center text-lg text-[#138A13]">
          Freie Woche!
        </Text>
        <Text className="mt-1 text-center text-sm leading-5 text-neutral">
          Keine Kurse eingetragen. Zeit zum Durchatmen.
        </Text>
      </View>
    </View>
  </View>
);

export const ScheduleScreen = () => {
  const { getCourse } = useCourses();
  const { timetable } = useScheduleData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [gridHeight, setGridHeight] = useState(0);
  const [gridWidth, setGridWidth] = useState(0);
  const weekDragX = useSharedValue(0);
  const bottomClearance = useMainTabBarPadding(12);
  const weekBottomClearance =
    Platform.OS === "ios" ? Math.max(bottomClearance - 72, 56) : bottomClearance;
  const resolvedGridHeight = gridHeight || GRID_FALLBACK_HEIGHT;

  const changeWeek = useCallback((delta: number) => {
    haptics.selection();
    setWeekOffset((current) => current + delta);
  }, []);

  const settleWeekSwipe = useCallback(
    (delta: number) => {
      changeWeek(delta);
    },
    [changeWeek],
  );

  useLayoutEffect(() => {
    weekDragX.value = 0;
  }, [weekDragX, weekOffset]);

  const swipeGesture = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Native(),
        Gesture.Pan()
          .activeOffsetX([-14, 14])
          .failOffsetY([-18, 18])
          .onUpdate((event) => {
            const width = gridWidth || 260;
            const limit = width;
            const distance = Math.abs(event.translationX);
            const sign = event.translationX < 0 ? -1 : 1;

            weekDragX.value =
              distance <= limit ? event.translationX : sign * (limit + (distance - limit) * 0.18);
          })
          .onEnd((event) => {
            const width = gridWidth || 260;
            const threshold = Math.max(WEEK_SWIPE_MIN_DISTANCE, width * 0.23);
            const shouldMoveNext =
              event.translationX < -threshold || event.velocityX < -WEEK_SWIPE_VELOCITY;
            const shouldMovePrevious =
              event.translationX > threshold || event.velocityX > WEEK_SWIPE_VELOCITY;

            if (shouldMoveNext || shouldMovePrevious) {
              const delta = shouldMoveNext ? 1 : -1;
              const exitX = delta > 0 ? -width : width;

              weekDragX.value = withTiming(
                exitX,
                {
                  duration: 170,
                  easing: Easing.out(Easing.quad),
                },
                (finished) => {
                  if (finished) {
                    runOnJS(settleWeekSwipe)(delta);
                  }
                },
              );
              return;
            }

            weekDragX.value = withSpring(0, {
              damping: 22,
              mass: 0.82,
              stiffness: 260,
            });
          }),
      ),
    [gridWidth, settleWeekSwipe, weekDragX],
  );

  const weekContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: weekDragX.value }],
  }));
  const weekHeaderContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: weekDragX.value }],
  }));

  const weekStart = useMemo(() => addWeeks(startOfISOWeek(new Date()), weekOffset), [weekOffset]);
  const weekPages = useMemo(
    () =>
      WEEK_PAGE_OFFSETS.map((relativeOffset) => {
        const pageWeekStart = addWeeks(weekStart, relativeOffset);
        const pageWeekEnd = subMilliseconds(addDays(pageWeekStart, 5), 1);
        const pageWeekdays = WEEKDAY_LABELS.map((_, index) => addDays(pageWeekStart, index));

        const pageEntries = timetable
          .map((entry) => ({
            ...entry,
            weekday: (getDay(entry.start) + 6) % 7,
            startMinutes: entry.start.getHours() * 60 + entry.start.getMinutes(),
          }))
          .filter(
            (entry) =>
              entry.weekday < WEEKDAY_LABELS.length &&
              entry.start.getTime() >= pageWeekStart.getTime() &&
              entry.start.getTime() <= pageWeekEnd.getTime(),
          )
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        return {
          entries: pageEntries,
          relativeOffset,
          weekStart: pageWeekStart,
          weekdays: pageWeekdays,
        };
      }),
    [timetable, weekStart],
  );

  const currentWeek = getISOWeek(weekStart);
  const now = new Date();
  const nowWeekday = (getDay(now) + 6) % 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const canShowNowMarker =
    nowWeekday >= 0 &&
    nowWeekday < WEEKDAY_LABELS.length &&
    nowMinutes >= DAY_START &&
    nowMinutes <= DAY_END;
  const measuredGridWidth = gridWidth || 1;

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
              <View className="h-12 flex-1 overflow-hidden">
                <Animated.View className="absolute inset-0" style={weekHeaderContentStyle}>
                  {weekPages.map((page) => (
                    <View
                      key={`header-${page.weekStart.toISOString()}`}
                      accessibilityElementsHidden={page.relativeOffset !== 0}
                      className="absolute top-0 bottom-0 flex-row"
                      importantForAccessibility={
                        page.relativeOffset === 0 ? "auto" : "no-hide-descendants"
                      }
                      style={{
                        width: measuredGridWidth,
                        transform: [{ translateX: page.relativeOffset * measuredGridWidth }],
                      }}
                    >
                      {page.weekdays.map((day, index) => (
                        <View
                          key={day.toISOString()}
                          className="flex-1 items-center justify-center"
                        >
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
                  ))}
                </Animated.View>
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

          <View
            className="min-h-0 flex-1"
            onLayout={({ nativeEvent }) => {
              const nextWidth = nativeEvent.layout.width;
              if (nextWidth > 0 && Math.abs(nextWidth - gridWidth) > 1) {
                setGridWidth(nextWidth);
              }
            }}
          >
            <Card
              padding="none"
              radius="sm"
              className="relative flex-1 overflow-hidden"
              style={{ flex: 1 }}
            >
              <GestureDetector gesture={swipeGesture}>
                <Animated.View className="absolute inset-0" style={weekContentStyle}>
                  {weekPages.map((page) => {
                    const showNowMarker =
                      canShowNowMarker && weekOffset + page.relativeOffset === 0;

                    return (
                      <View
                        key={page.weekStart.toISOString()}
                        accessibilityElementsHidden={page.relativeOffset !== 0}
                        className="absolute top-0 bottom-0"
                        importantForAccessibility={
                          page.relativeOffset === 0 ? "auto" : "no-hide-descendants"
                        }
                        style={{
                          width: measuredGridWidth,
                          transform: [{ translateX: page.relativeOffset * measuredGridWidth }],
                        }}
                      >
                        {page.weekdays.map((day, index) => (
                          <View
                            key={`day-bg-${day.toISOString()}`}
                            className="absolute top-0 bottom-0"
                            style={{
                              left: weekdayToPercent(index),
                              width: `${100 / WEEKDAY_LABELS.length}%`,
                              backgroundColor: isToday(day)
                                ? "rgba(59, 127, 217, 0.08)"
                                : "transparent",
                            }}
                          />
                        ))}

                        {page.weekdays.slice(1).map((day, index) => (
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

                        {page.entries.map((entry) => {
                          const course = getCourse(entry.courseId);
                          if (!course) return null;

                          const end = addMinutes(entry.start, entry.duration);
                          const timetableLabel =
                            timetableSubjectLabelMap[course.subject] ??
                            subjectNameMap[course.subject];

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

                        {page.entries.length === 0 ? (
                          <View className="absolute inset-0 items-center justify-center">
                            <EmptyWeekState />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </Animated.View>
              </GestureDetector>
            </Card>
          </View>
        </View>
      </View>
    </View>
  );
};
