import {
  addDays,
  addWeeks,
  format,
  getDay,
  getISOWeek,
  getISOWeekYear,
  isToday,
  startOfISOWeek,
  subMilliseconds,
} from "date-fns";
import { de as localeDE } from "date-fns/locale/de";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { type DimensionValue, ScrollView, View } from "react-native";
import { Card } from "~/components/card";
import { IconButton } from "~/components/icon-button";
import { SafeAreaView } from "react-native-safe-area-context";
import { SubjectIcon } from "~/components/subject-icon";
import { shadow } from "~/components/styles/shadow";
import { Text } from "~/components/text";
import { haptics } from "~/utils/haptics";
import { subjectNameMap } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";
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
  { minute: 17 * 60, label: "17:00" },
];
const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr"];
const DAY_START = 8 * 60;
const DAY_END = 17 * 60;
const DAY_DURATION = DAY_END - DAY_START;
const GRID_MIN_HEIGHT = 560;
const TIME_RAIL_WIDTH = 44;

const timeToPosition = (minute: number) => ((minute - DAY_START) / DAY_DURATION) * GRID_MIN_HEIGHT;
const durationToHeight = (duration: number) => (duration / DAY_DURATION) * GRID_MIN_HEIGHT;
const weekdayToPercent = (weekday: number) =>
  `${(weekday / WEEKDAY_LABELS.length) * 100}%` as DimensionValue;

const formatWeekLabel = (weekStart: Date) => {
  const weekEnd = addDays(weekStart, 4);
  return `${format(weekStart, "dd.MM.", { locale: localeDE })} - ${format(weekEnd, "dd.MM.", {
    locale: localeDE,
  })}`;
};

export const SchedulePage = () => {
  const { getCourse, timetable } = useMockApp();
  const [weekOffset, setWeekOffset] = useState(0);

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
  const currentYear = getISOWeekYear(weekStart);
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
    <View className="flex-1 bg-[#F7F8FB]">
      <View style={[shadow, { backgroundColor: colors.primary.DEFAULT }]}>
        <SafeAreaView edges={["top"]}>
          <View className="px-4 pt-2 pb-3">
            <Text weight="bold" className="text-center text-[34px] text-white">
              {formatWeekLabel(weekStart)}
            </Text>
            <View className="h-2" />
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

      <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
        <View className="px-4 pt-3">
          <View className="flex-row">
            <View style={{ width: TIME_RAIL_WIDTH }}>
              {TIME_MARKERS.map((marker) => (
                <Text
                  key={marker.minute}
                  className="absolute right-1 text-[13px] text-neutral"
                  style={{ top: timeToPosition(marker.minute) - 8 }}
                >
                  {marker.label}
                </Text>
              ))}
            </View>

            <Card
              padding="none"
              className="relative flex-1 overflow-hidden"
              style={{ minHeight: GRID_MIN_HEIGHT }}
            >
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
                  style={{ top: timeToPosition(marker.minute), height: 1 }}
                />
              ))}

              {visibleEntries.map((entry) => {
                const course = getCourse(entry.courseId);
                if (!course) return null;

                return (
                  <Card
                    key={entry.id}
                    onPress={() => {
                      router.push({
                        pathname: "/courses/[course]",
                        params: { course: course.id },
                      });
                    }}
                    padding="none"
                    radius="sm"
                    backgroundColor={colors.accent.DEFAULT}
                    className="absolute overflow-hidden"
                    style={[
                      {
                        top: timeToPosition(entry.start.getHours() * 60 + entry.start.getMinutes()),
                        left: weekdayToPercent(entry.weekday),
                        width: `${100 / WEEKDAY_LABELS.length}%`,
                        height: durationToHeight(entry.duration),
                      },
                    ]}
                  >
                    <View className="items-center px-2 py-2">
                      <View className="rounded-full bg-white p-1.5">
                        <SubjectIcon subject={course.subject} />
                      </View>
                      <View className="h-1.5" />
                      <Text
                        weight="bold"
                        className="text-center text-[13px] text-white"
                        numberOfLines={2}
                      >
                        {subjectNameMap[course.subject]}
                      </Text>
                      <Text className="pt-0.5 text-center text-[11px] text-white/85">
                        {format(entry.start, "HH:mm")}
                      </Text>
                    </View>
                  </Card>
                );
              })}

              {showNowMarker ? (
                <>
                  <View
                    className="absolute z-10 h-2 w-2 rounded-full bg-[#E54F64]"
                    style={{
                      top: timeToPosition(nowMinutes),
                      left: weekdayToPercent(nowWeekday),
                      marginTop: -4,
                      marginLeft: -4,
                    }}
                  />
                  <View
                    className="absolute right-0 z-10 h-px bg-[#E54F64]"
                    style={{
                      top: timeToPosition(nowMinutes),
                      left: weekdayToPercent(nowWeekday),
                    }}
                  />
                </>
              ) : null}

              {visibleEntries.length === 0 ? (
                <View className="absolute inset-0 items-center justify-center">
                  <Text className="text-lg text-neutral">Diese Woche ist noch leer.</Text>
                </View>
              ) : null}
            </Card>
          </View>
        </View>
      </ScrollView>

      <View className="bg-white px-4 py-2.5" style={shadow}>
        <View className="flex-row items-center justify-between">
          <IconButton
            icon="chevron-left"
            variant="subtle"
            onPress={() => {
              haptics.selection();
              setWeekOffset((current) => current - 1);
            }}
          />
          <Text weight="semi-bold" className="text-base text-primary-text">
            KW {currentWeek}
            {currentYear === new Date().getFullYear() ? "" : ` (${currentYear})`}
          </Text>
          <IconButton
            icon="chevron-right"
            variant="subtle"
            onPress={() => {
              haptics.selection();
              setWeekOffset((current) => current + 1);
            }}
          />
        </View>
      </View>
    </View>
  );
};
