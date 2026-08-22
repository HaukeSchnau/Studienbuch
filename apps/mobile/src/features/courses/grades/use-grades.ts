import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useCallback } from "react";
import { getCourseGrades as selectCourseGrades, type GradeType } from "~/compat/mobile-v0";
import {
  gradesAtom,
  restoreLatestConfirmedGradeAtom,
  signGradeAtom,
  upsertGradeAtom,
  type GradeSigner,
  type UpsertGradeInput,
} from "./grade-atoms";

export function useGrades() {
  const grades = useAtomValue(gradesAtom);
  const upsert = useAtomSet(upsertGradeAtom);
  const sign = useAtomSet(signGradeAtom);
  const restore = useAtomSet(restoreLatestConfirmedGradeAtom);
  const getCourseGrades = useCallback(
    (courseId: string) => selectCourseGrades(grades, courseId),
    [grades],
  );
  const upsertGrade = useCallback((input: UpsertGradeInput) => upsert(input), [upsert]);
  const signGrade = useCallback(
    (gradeId: string, signer: GradeSigner) => sign({ gradeId, signer }),
    [sign],
  );
  const restoreLatestConfirmedGrade = useCallback(
    (courseId: string, type: GradeType, isOfAge: boolean) => restore({ courseId, type, isOfAge }),
    [restore],
  );

  return { grades, getCourseGrades, upsertGrade, signGrade, restoreLatestConfirmedGrade };
}
