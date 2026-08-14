import {
  findCurrentSemester,
  getActiveHoliday,
  getCourseGrades,
  getCourseTasks,
  getRequiredSetupPath,
  getSelectedSemesterCourses,
  getVisibleTimetable,
  isGradeConfirmed,
  type Absence,
  type Course,
  type Grade,
  type GradeType,
  type Holiday,
  type SchoolClass,
  type Semester,
  type Task,
  type TaskAttachment,
  type TimetableEntry,
  type UserProfile,
  type Year,
} from "@stu/core/compat/mobile-v0";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import {
  absencesSeed,
  classes,
  coursesSeed,
  gradesSeed,
  holidaysSeed,
  semesters,
  tasksSeed,
  timetableSeed,
  years,
} from "./fixtures";
import { createMockId } from "./mock-ids";
import { mockSignatureSvg } from "./mock-signatures";

interface MockDataContextValue {
  user: UserProfile;
  years: Year[];
  classes: SchoolClass[];
  semesters: Semester[];
  courses: Course[];
  holidays: Holiday[];
  timetable: TimetableEntry[];
  absences: Absence[];
  grades: Grade[];
  tasks: Task[];
  getRequiredSetupPath: () =>
    | "/setup/license-key"
    | "/setup/name-and-year"
    | "/setup/class-and-courses"
    | null;
  getActiveHoliday: (date?: Date) => Holiday | undefined;
  getCourse: (courseId: string) => Course | undefined;
  getSemesterCourses: (semesterId: string) => Course[];
  getCourseGrades: (courseId: string) => Grade[];
  getTask: (taskId: string) => Task | undefined;
  getCourseTasks: (courseId?: string) => Task[];
  updateProfile: (patch: Partial<UserProfile>) => void;
  setSelectedCourses: (semesterId: string, courseIds: string[]) => void;
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
  addTask: (payload: {
    courseId: string;
    title: string;
    description: string;
    dueDate: Date;
    attachments?: TaskAttachment[];
  }) => void;
  addTaskAttachment: (taskId: string, attachment: TaskAttachment) => void;
  toggleTaskDone: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
}

const MockDataContext = createContext<MockDataContextValue | null>(null);

const currentSemester = findCurrentSemester(semesters);
const initialCourseIds = coursesSeed
  .filter((course) => course.semesterId === currentSemester?.id)
  .map((course) => course.id);

export function MockDataProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserProfile>({
    name: "Hauke",
    isOfAge: false,
    yearId: "y12",
    classId: "c12a",
    schoolName: "IGS Lilienthal",
    licenseKey: "STUB-U123-2026-UI00",
  });
  const [selectedCourseIdsBySemester, setSelectedCourseIdsBySemester] = useState<
    Record<string, string[]>
  >({
    s1: ["de-0", "ma-0", "en-0", "ge-0"],
    s2: initialCourseIds,
  });
  const [absences, setAbsences] = useState(absencesSeed);
  const [grades, setGrades] = useState(gradesSeed);
  const [tasks, setTasks] = useState(tasksSeed);

  const getCourse = (courseId: string) => coursesSeed.find((course) => course.id === courseId);

  const value: MockDataContextValue = {
    user,
    years,
    classes,
    semesters,
    courses: coursesSeed,
    holidays: holidaysSeed,
    timetable: getVisibleTimetable(timetableSeed, coursesSeed, selectedCourseIdsBySemester),
    absences,
    grades,
    tasks,
    getRequiredSetupPath: () =>
      getRequiredSetupPath({ user, currentSemester, selectedCourseIdsBySemester }),
    getActiveHoliday: (date?: Date) => getActiveHoliday(holidaysSeed, date),
    getCourse,
    getSemesterCourses: (semesterId) =>
      getSelectedSemesterCourses(coursesSeed, semesterId, selectedCourseIdsBySemester),
    getCourseGrades: (courseId) => getCourseGrades(grades, courseId),
    getTask: (taskId) => tasks.find((task) => task.id === taskId),
    getCourseTasks: (courseId) => getCourseTasks(tasks, courseId),
    updateProfile: (patch) => {
      setUser((current) => ({ ...current, ...patch }));
    },
    setSelectedCourses: (semesterId, courseIds) => {
      setSelectedCourseIdsBySemester((current) => ({ ...current, [semesterId]: courseIds }));
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
    addTask: ({ courseId, title, description, dueDate, attachments = [] }) => {
      setTasks((current) => [
        {
          id: createMockId("task"),
          courseId,
          title,
          description,
          dueDate,
          done: false,
          attachments,
        },
        ...current,
      ]);
    },
    addTaskAttachment: (taskId, attachment) => {
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, attachments: [...task.attachments, attachment] } : task,
        ),
      );
    },
    toggleTaskDone: (taskId) => {
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
      );
    },
    deleteTask: (taskId) => {
      setTasks((current) => current.filter((task) => task.id !== taskId));
    },
  };

  return <MockDataContext.Provider value={value}>{children}</MockDataContext.Provider>;
}

export function useMockDataRuntime() {
  const value = useContext(MockDataContext);
  if (!value) {
    throw new Error("Mock data context is missing");
  }
  return value;
}
