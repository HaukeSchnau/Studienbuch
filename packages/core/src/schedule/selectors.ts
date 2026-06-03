import type { Course } from "../courses/model";
import type { Holiday, TimetableEntry } from "./model";

export const getVisibleTimetable = (
  timetable: TimetableEntry[],
  courses: Course[],
  selectedCourseIdsBySemester: Record<string, string[]>,
) =>
  timetable.filter((entry) => {
    const course = courses.find((item) => item.id === entry.courseId);
    return course
      ? (selectedCourseIdsBySemester[course.semesterId] ?? []).includes(course.id)
      : false;
  });

export const getActiveHoliday = (holidays: Holiday[], date = new Date()) =>
  holidays.find((holiday) => date >= holiday.start && date <= holiday.end);
