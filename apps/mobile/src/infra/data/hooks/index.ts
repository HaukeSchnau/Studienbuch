import type { GradeType } from "~/compat/mobile-v0";
import { useProfile } from "~/features/profile/use-profile";
import { useMockDataRuntime } from "../mock/provider";

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
