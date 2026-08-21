import { getVisibleTimetable, type GradeType } from "~/compat/mobile-v0";
import { useCourses, useCourseSelection } from "~/features/courses/use-courses";
import { useProfile } from "~/features/profile/use-profile";
import { useMockDataRuntime } from "../mock/provider";

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
  const { profile } = useProfile();

  return {
    grades,
    getCourseGrades,
    upsertGrade,
    signGrade,
    restoreLatestConfirmedGrade: (courseId: string, type: GradeType) =>
      restoreLatestConfirmedGrade(courseId, type, profile.isOfAge),
  };
};
