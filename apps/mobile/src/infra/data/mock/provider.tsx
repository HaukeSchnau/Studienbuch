import {
  getCourseGrades,
  isGradeConfirmed,
  type Absence,
  type Grade,
  type GradeType,
} from "~/compat/mobile-v0";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { absencesSeed, gradesSeed } from "./fixtures";
import { createMockId } from "~/infra/mock-data/id";
import { mockSignatureSvg } from "./mock-signatures";

interface MockDataContextValue {
  absences: Absence[];
  grades: Grade[];
  getCourseGrades: (courseId: string) => Grade[];
  addAbsence: (absence: { date: Date; courseIds: string[]; reason: string }) => void;
  deleteAbsence: (absenceId: string) => void;
  signAbsence: (absenceId: string, signer: "parent" | "teacher") => void;
  upsertGrade: (payload: {
    courseId: string;
    type: GradeType;
    result: number;
    date?: Date;
  }) => void;
  signGrade: (gradeId: string, signer: "parent" | "teacher") => void;
  restoreLatestConfirmedGrade: (courseId: string, type: GradeType, isOfAge: boolean) => void;
}

// Missing providers degrade to an empty, read-only data source. The app shell installs the real
// provider, but keeping the context total lets render code represent absence without exceptions.
const unavailableMockDataRuntime: MockDataContextValue = {
  absences: [],
  grades: [],
  getCourseGrades: () => [],
  addAbsence: () => undefined,
  deleteAbsence: () => undefined,
  signAbsence: () => undefined,
  upsertGrade: () => undefined,
  signGrade: () => undefined,
  restoreLatestConfirmedGrade: () => undefined,
};

const MockDataContext = createContext<MockDataContextValue>(unavailableMockDataRuntime);

export function MockDataProvider({ children }: PropsWithChildren) {
  const [absences, setAbsences] = useState(absencesSeed);
  const [grades, setGrades] = useState(gradesSeed);

  const value: MockDataContextValue = {
    absences,
    grades,
    getCourseGrades: (courseId) => getCourseGrades(grades, courseId),
    addAbsence: ({ date, courseIds, reason }) => {
      setAbsences((current) => [
        {
          id: createMockId("absence"),
          date,
          courseIds,
          reason,
          parentSignature: null,
          teacherSignature: null,
        },
        ...current,
      ]);
    },
    deleteAbsence: (absenceId) => {
      setAbsences((current) => current.filter((absence) => absence.id !== absenceId));
    },
    signAbsence: (absenceId, signer) => {
      setAbsences((current) =>
        current.map((absence) =>
          absence.id === absenceId
            ? {
                ...absence,
                ...(signer === "parent"
                  ? { parentSignature: mockSignatureSvg("Erziehungsberechtigt") }
                  : { teacherSignature: mockSignatureSvg("Lehrkraft") }),
              }
            : absence,
        ),
      );
    },
    upsertGrade: ({ courseId, type, result, date = new Date() }) => {
      setGrades((current) => {
        if (type === "WRITTEN") {
          return [
            {
              id: createMockId("grade"),
              courseId,
              type,
              result,
              date,
              teacherSignature: null,
              parentSignature: null,
            },
            ...current,
          ];
        }

        const existing = current.find(
          (grade) => grade.courseId === courseId && grade.type === type,
        );
        if (!existing) {
          return [
            {
              id: createMockId("grade"),
              courseId,
              type,
              result,
              date,
              teacherSignature: null,
              parentSignature: null,
            },
            ...current,
          ];
        }

        return current.map((grade) =>
          grade.id === existing.id
            ? {
                ...grade,
                result,
                date,
                teacherSignature: null,
                parentSignature: null,
              }
            : grade,
        );
      });
    },
    signGrade: (gradeId, signer) => {
      setGrades((current) =>
        current.map((grade) =>
          grade.id === gradeId
            ? {
                ...grade,
                ...(signer === "parent"
                  ? { parentSignature: mockSignatureSvg("Erziehungsberechtigt") }
                  : { teacherSignature: mockSignatureSvg("Lehrkraft") }),
              }
            : grade,
        ),
      );
    },
    restoreLatestConfirmedGrade: (courseId, type, isOfAge) => {
      setGrades((current) => {
        const confirmedGrade = current.find(
          (grade) =>
            grade.courseId === courseId && grade.type === type && isGradeConfirmed(grade, isOfAge),
        );
        const currentGrade = current.find(
          (grade) => grade.courseId === courseId && grade.type === type,
        );
        if (!confirmedGrade) {
          return current;
        }
        if (!currentGrade) {
          return [
            {
              ...confirmedGrade,
              id: createMockId("grade"),
              date: new Date(),
              teacherSignature: null,
              parentSignature: null,
            },
            ...current,
          ];
        }

        return current.map((grade) =>
          grade.id === currentGrade.id
            ? {
                ...grade,
                result: confirmedGrade.result,
                date: new Date(),
                teacherSignature: null,
                parentSignature: null,
              }
            : grade,
        );
      });
    },
  };

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>;
}

export function useMockDataRuntime() {
  return useContext(MockDataContext);
}
