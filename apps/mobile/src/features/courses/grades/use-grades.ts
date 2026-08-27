import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import { getCourseGrades as selectCourseGrades, type GradeType } from "~/compat/mobile-v0";
import {
  gradesAtom,
  restoreLatestConfirmedGradeAtom,
  signGradeAtom,
  upsertGradeAtom,
  type GradeSigner,
} from "./grade-atoms";

export function useGrades() {
  const grades = useAtomValue(gradesAtom);
  const upsertGrade = useAtomSet(upsertGradeAtom);
  const writeSignGrade = useAtomSet(signGradeAtom);
  const writeRestoreLatestConfirmedGrade = useAtomSet(restoreLatestConfirmedGradeAtom);
  const getCourseGrades = useCallback(
    (courseId: string) => selectCourseGrades(grades, courseId),
    [grades],
  );
  const signGrade = useCallback(
    (gradeId: string, signer: GradeSigner) => writeSignGrade({ gradeId, signer }),
    [writeSignGrade],
  );
  const restoreLatestConfirmedGrade = useCallback(
    (courseId: string, type: GradeType, isOfAge: boolean) =>
      writeRestoreLatestConfirmedGrade({ courseId, type, isOfAge }),
    [writeRestoreLatestConfirmedGrade],
  );

  return { grades, getCourseGrades, upsertGrade, signGrade, restoreLatestConfirmedGrade };
}
