import {
  getActiveHoliday,
  getCourseGrades,
  isGradeConfirmed,
  type Absence,
  type Grade,
  type GradeType,
  type Holiday,
  type TimetableEntry,
  type UserProfile,
} from "~/compat/mobile-v0";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { absencesSeed, gradesSeed, holidaysSeed, timetableSeed } from "./fixtures";
import { createMockId } from "~/infra/mock-data/id";
import { mockSignatureSvg } from "./mock-signatures";

interface MockDataContextValue {
  user: UserProfile;
  holidays: Holiday[];
  timetable: TimetableEntry[];
  absences: Absence[];
  grades: Grade[];
  getActiveHoliday: (date?: Date) => Holiday | undefined;
  getCourseGrades: (courseId: string) => Grade[];
  updateProfile: (patch: Partial<UserProfile>) => void;
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
  restoreLatestConfirmedGrade: (courseId: string, type: GradeType) => void;
}

const initialLicenseKey =
  process.env.EXPO_PUBLIC_E2E_SCENARIO === "startup" ? "" : "STUB-U123-2026-UI00";
const initialUser: UserProfile = {
  name: "Hauke",
  isOfAge: false,
  yearId: "y12",
  classId: "c12a",
  schoolName: "IGS Lilienthal",
  licenseKey: initialLicenseKey,
};

// Missing providers degrade to an empty, read-only data source. The app shell installs the real
// provider, but keeping the context total lets render code represent absence without exceptions.
const unavailableMockDataRuntime: MockDataContextValue = {
  user: initialUser,
  holidays: [],
  timetable: [],
  absences: [],
  grades: [],
  getActiveHoliday: () => undefined,
  getCourseGrades: () => [],
  updateProfile: () => undefined,
  addAbsence: () => undefined,
  deleteAbsence: () => undefined,
  signAbsence: () => undefined,
  upsertGrade: () => undefined,
  signGrade: () => undefined,
  restoreLatestConfirmedGrade: () => undefined,
};

const MockDataContext = createContext<MockDataContextValue>(unavailableMockDataRuntime);

export function MockDataProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile>(initialUser);
  const [absences, setAbsences] = useState(absencesSeed);
  const [grades, setGrades] = useState(gradesSeed);

  const value: MockDataContextValue = {
    user,
    holidays: holidaysSeed,
    timetable: timetableSeed,
    absences,
    grades,
    getActiveHoliday: (date?: Date) => getActiveHoliday(holidaysSeed, date),
    getCourseGrades: (courseId) => getCourseGrades(grades, courseId),
    updateProfile: (patch) => {
      setUser((current) => ({ ...current, ...patch }));
    },
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
    restoreLatestConfirmedGrade: (courseId, type) => {
      setGrades((current) => {
        const confirmedGrade = current.find(
          (grade) =>
            grade.courseId === courseId &&
            grade.type === type &&
            isGradeConfirmed(grade, user.isOfAge),
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
