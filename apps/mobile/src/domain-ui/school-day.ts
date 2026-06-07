import { compareAsc, isBefore, isSameDay, startOfDay } from "date-fns";
import type { TimetableEntry } from "@stu/core";

export const getEntriesForSchoolDay = (timetable: TimetableEntry[], date: Date) =>
  timetable
    .filter((entry) => isSameDay(entry.start, date))
    .sort((a, b) => compareAsc(a.start, b.start));

export const getNextSchoolDay = (timetable: TimetableEntry[], from = new Date()) => {
  const today = startOfDay(from);
  const sortedDates = timetable
    .map((entry) => startOfDay(entry.start))
    .sort(compareAsc)
    .filter((date, index, dates) => index === 0 || !isSameDay(date, dates[index - 1]!));

  return sortedDates.find((date) => !isBefore(date, today)) ?? sortedDates[0] ?? today;
};
