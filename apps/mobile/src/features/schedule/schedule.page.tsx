import { getDay, getISOWeek, getISOWeekYear } from "date-fns";
import { router } from "expo-router";
import { useState } from "react";
import { type DimensionValue, Pressable, View } from "react-native";
import { SubjectIcon } from "~/components/subject-icon";
import { Text } from "~/components/text";
import { subjectNameMap } from "~/mock-app/domain";
import { useMockApp } from "~/mock-app/provider";

const getCurrentWeek = () => {
  const today = new Date();
  return {
    week: getISOWeek(today),
    year: getISOWeekYear(today),
  };
};

const TICKS = [
  8 * 60,
  9 * 60 + 20,
  9 * 60 + 45,
  11 * 60 + 5,
  11 * 60 + 30,
  12 * 60 + 50,
  13 * 60 + 50,
  15 * 60 + 10,
];
const DAY_START = 8 * 60;
const DAY_END = 17 * 60;
const DAY_DURATION = DAY_END - DAY_START;
const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

const timeOfDayToYPosition = (time: number): DimensionValue =>
  `${((time - DAY_START) / DAY_DURATION) * 100}%`;
const weekdayToXPosition = (weekday: number): DimensionValue =>
  `${(weekday / WEEKDAYS.length) * 100}%`;
const dateToTimeOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();
const durationToHeight = (duration: number): DimensionValue =>
  `${(duration / DAY_DURATION) * 100}%`;
const WIDTH: DimensionValue = `${100 / WEEKDAYS.length}%`;

export const SchedulePage = () => {
  const [calendarWeek] = useState(getCurrentWeek());
  const { timetable, getCourse } = useMockApp();

  void calendarWeek;

  return (
    <View className="flex-1">
      <View className="flex-row justify-around py-2">
        {WEEKDAYS.map((day) => (
          <View key={day} className="flex-1">
            <Text className="text-center">{day}</Text>
          </View>
        ))}
      </View>

      <View className="relative flex-1">
        {TICKS.map((tick) => (
          <View
            key={tick}
            className="absolute right-0 left-0 bg-[#00000020]"
            style={{ top: timeOfDayToYPosition(tick), height: 1 }}
          />
        ))}

        {timetable.map((entry) => {
          const weekday = (getDay(entry.start) + 6) % 7;
          const course = getCourse(entry.courseId);
          if (!course || weekday >= WEEKDAYS.length) return null;

          return (
            <Pressable
              onPress={() => {
                router.push({
                  pathname: "/courses/[course]",
                  params: { course: course.id },
                });
              }}
              key={entry.id}
              className="absolute items-center justify-center rounded-md bg-accent/80"
              style={{
                top: timeOfDayToYPosition(dateToTimeOfDay(entry.start)),
                left: weekdayToXPosition(weekday),
                width: WIDTH,
                height: durationToHeight(entry.duration),
              }}
            >
              <View className="rounded-full bg-white p-1">
                <SubjectIcon subject={course.subject} />
              </View>
              <Text className="pt-2 text-center text-lg text-white">
                {subjectNameMap[course.subject]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
