import { type AgendaEntry, subjectNameMap } from "@stu/lib";
import { useQuery } from "@tanstack/react-query";
import { getDay, getISOWeek, getISOWeekYear } from "date-fns";
import { router } from "expo-router";
import React, { useState } from "react";
import { type DimensionValue, TouchableOpacity, View } from "react-native";
import { SubjectIcon } from "~/components/subject-icon";
import { Text } from "~/components/text";
import { getTimetableWeek } from "../agenda/queries/week";

const getCurrentWeek = () => {
  const today = new Date();
  return {
    week: getISOWeek(today),
    year: getISOWeekYear(today),
  };
};

const TICKS = [8 * 60, 9 * 60 + 20, 9 * 60 + 45, 11 * 60 + 5, 11 * 60 + 30, 12 * 60 + 50, 13 * 60 + 50, 15 * 60 + 10];

const DAY_START = 8 * 60;
const DAY_END = 17 * 60;
const DAY_DURATION = DAY_END - DAY_START;

const WEEKDAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

const timeOfDayToYPosition = (time: number): DimensionValue => {
  return `${((time - DAY_START) / DAY_DURATION) * 100}%`;
};

const weekdayToXPosition = (weekday: number): DimensionValue => {
  return `${(weekday / WEEKDAYS.length) * 100}%`;
};

const dateToTimeOfDay = (date: Date) => {
  return date.getHours() * 60 + date.getMinutes();
};

const durationToHeight = (duration: number): DimensionValue => {
  return `${(duration / DAY_DURATION) * 100}%`;
};

const WIDTH: DimensionValue = `${100 / WEEKDAYS.length}%`;

const TimetableBackground = () => {
  return TICKS.map((tick) => (
    <View
      key={tick}
      className="absolute right-0 left-0 bg-[#00000020]"
      style={{
        top: timeOfDayToYPosition(tick),
        height: 1,
      }}
    />
  ));
};

const TimetableHeader = () => {
  return (
    <View className="flex flex-row justify-around py-2">
      {WEEKDAYS.map((day) => (
        <View key={day} className="flex-1">
          <Text className="text-center">{day}</Text>
        </View>
      ))}
    </View>
  );
};

const ScheduleView = ({ calendarWeek }: { calendarWeek: { week: number; year: number } }) => {
  const { data: timetable } = useQuery({
    ...getTimetableWeek({
      isoWeek: 26,
      isoWeekYear: calendarWeek.year,
    }),
    // group by day
    select: (data) => {
      const days = new Map<number, AgendaEntry[]>();
      for (const entry of data) {
        let weekday = getDay(entry.start); // start on 0 for sunday
        // map to 0-5 (monday-friday)
        weekday = (weekday + 6) % 7;
        days.set(weekday, [...(days.get(weekday) || []), entry]);
      }
      return days;
    },
  });

  return (
    <View className="flex-1">
      <TimetableHeader />
      <View className="relative flex-1">
        <TimetableBackground />
        {[...(timetable?.entries() ?? [])].map(([day, entries]) => (
          <React.Fragment key={day}>
            {entries.map((entry) => (
              <TouchableOpacity
                onPress={() => {
                  router.push({
                    pathname: "/courses/[course]",
                    params: {
                      course: entry.course.id,
                    },
                  });
                }}
                key={`${entry.start.getTime()}-${entry.course.id}`}
                className="absolute flex items-center justify-center rounded-md bg-accent/80"
                style={{
                  top: timeOfDayToYPosition(dateToTimeOfDay(entry.start)),
                  left: weekdayToXPosition(day),
                  width: WIDTH,
                  height: durationToHeight(entry.duration),
                }}
              >
                <View className="rounded-full bg-white p-1">
                  <SubjectIcon subject={entry.course.subject} />
                </View>
                <Text className="pt-2 text-center text-lg text-white">{subjectNameMap[entry.course.subject]}</Text>
              </TouchableOpacity>
            ))}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
};

export const SchedulePage = () => {
  const [calendarWeek] = useState(getCurrentWeek());

  return <ScheduleView calendarWeek={calendarWeek} />;
};
