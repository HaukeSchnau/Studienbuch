import type { Course, CourseTime, CourseTimeWeeks } from "@acme/db";

import { getNormalTimeIndex } from "../date";
import type { Teacher } from "./teacher";

export interface TimetableEntry {
  course: Omit<Course, "createdAt" | "room"> & {
    teacher: Teacher;
  }; // TODO: Fix this when we move away from Flutter and to React Native so we don't need the Prisma Zod generator anymore
  weeks: CourseTimeWeeks;
  duration: number;
}

export type TimetableCell = TimetableEntry[];

export type Timetable = TimetableCell[][];

export const buildTimetable = (
  courses: (Omit<Course, "createdAt" | "room"> & {
    times: Omit<CourseTime, "courseId">[]; // TODO Same as above
    teacher: Teacher;
  })[],
): Timetable => {
  const timetable: Timetable = [];

  for (const course of courses) {
    for (const time of course.times) {
      const { duration, start, weekday, weeks } = time;

      const entry: TimetableEntry = {
        course,
        weeks,
        duration,
      };
      const startIndex = getNormalTimeIndex(start);

      const period = (timetable[startIndex] ??= []);
      const cell = (period[weekday - 1] ??= []);

      cell.push(entry);
    }
  }

  return timetable;
};

const WEEKS_MAP = {
  ODD: "A",
  EVEN: "B",
  BOTH: "AB",
};

export const formatWeeks = (weeks: CourseTimeWeeks) => {
  return WEEKS_MAP[weeks];
};
