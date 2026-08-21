import { getVisibleTimetable } from "~/compat/mobile-v0";
import { useCourses, useCourseSelection } from "~/features/courses/use-courses";
import { useMockDataRuntime } from "../mock/provider";

export const useSessionData = () => {
  const { user, updateProfile } = useMockDataRuntime();

  return { user, updateProfile };
};

export const useScheduleData = () => {
  const { holidays, timetable, getActiveHoliday } = useMockDataRuntime();
  const { courses } = useCourses();
  const selectedCourseIdsBySemester = useCourseSelection();

  return {
    holidays,
    timetable: getVisibleTimetable(timetable, courses, selectedCourseIdsBySemester),
    getActiveHoliday,
  };
};

export const useAbsences = () => {
  const { absences, addAbsence, deleteAbsence, signAbsence } = useMockDataRuntime();

  return { absences, addAbsence, deleteAbsence, signAbsence };
};

export const useGrades = () => {
  const { grades, getCourseGrades, upsertGrade, signGrade, restoreLatestConfirmedGrade } =
    useMockDataRuntime();

  return { grades, getCourseGrades, upsertGrade, signGrade, restoreLatestConfirmedGrade };
};
