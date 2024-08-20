import type { Course, CourseTimeWeeks } from "../courses";
import { getNormalTimeIndex } from "../courses";

export interface TimetableEntry {
  course: Course;
  weeks: CourseTimeWeeks;
  duration: number;
}

export type TimetableCell = TimetableEntry[];

export type Timetable = TimetableCell[][];

export const buildTimetable = (courses: Course[]): Timetable => {
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
