import { useQuery } from "@tanstack/react-query";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { useState } from "react";
import { View } from "react-native";
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

const ScheduleView = ({ calendarWeek }: { calendarWeek: { week: number; year: number } }) => {
  // biome-ignore lint/correctness/noUnusedVariables: work in progress
  const { data: timetable } = useQuery({
    ...getTimetableWeek({
      isoWeek: calendarWeek.week,
      isoWeekYear: calendarWeek.year,
    }),
  });

  return (
    <View className="relative flex-1">
      {TICKS.map((tick) => (
        <View
          key={tick}
          className="absolute right-0 left-0 bg-[#00000020]"
          style={{
            top: `${((tick - DAY_START) / DAY_DURATION) * 100}%`,
            height: 1,
          }}
        />
      ))}
      <View className="flex flex-row justify-around">
        <Text>Montag</Text>
        <Text>Dienstag</Text>
        <Text>Mittwoch</Text>
        <Text>Donnerstag</Text>
        <Text>Freitag</Text>
      </View>
    </View>
  );
};

export const SchedulePage = () => {
  const [calendarWeek] = useState(getCurrentWeek());

  return <ScheduleView calendarWeek={calendarWeek} />;
};
