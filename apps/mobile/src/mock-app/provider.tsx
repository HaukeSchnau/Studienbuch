import { addDays, isWithinInterval, set } from "date-fns";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import type {
  Absence,
  Course,
  Grade,
  GradeType,
  Holiday,
  SchoolClass,
  Semester,
  Task,
  TaskAttachment,
  TeacherInfo,
  TimetableEntry,
  Year,
} from "./domain";
import { findCurrentSemester, isGradeConfirmed } from "./domain";

interface UserProfile {
  name: string;
  isOfAge: boolean;
  yearId: string;
  classId: string;
  schoolName: string;
  licenseKey: string;
}

interface MockAppContextValue {
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
  toggleTaskDone: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
}

const MockAppContext = createContext<MockAppContextValue | null>(null);

const teachers: TeacherInfo[] = [
  { id: "t1", firstName: "Anna", lastName: "Meyer" },
  { id: "t2", firstName: "Tobias", lastName: "Kruse" },
  { id: "t3", firstName: "Nina", lastName: "Petersen" },
  { id: "t4", firstName: "Lars", lastName: "Becker" },
];

const years: Year[] = [
  { id: "y12", name: "Jahrgang 12", startYear: 2024, classLevel: 12 },
  { id: "y13", name: "Jahrgang 13", startYear: 2023, classLevel: 13 },
];

const classes: SchoolClass[] = [
  { id: "c12a", identifierInYear: "A", startYear: 2024 },
  { id: "c12b", identifierInYear: "B", startYear: 2024 },
  { id: "c13a", identifierInYear: "A", startYear: 2023 },
];

const semesters: Semester[] = [
  {
    id: "s1",
    name: "1. Semester",
    start: new Date("2025-08-01T00:00:00"),
    end: new Date("2026-01-31T00:00:00"),
  },
  {
    id: "s2",
    name: "2. Semester",
    start: new Date("2026-02-01T00:00:00"),
    end: new Date("2026-07-31T00:00:00"),
  },
];

const coursesSeed: Course[] = [
  { id: "de-1", name: "Deutsch LK", subject: "de", teachers: [teachers[0]!], semesterId: "s2" },
  { id: "en-1", name: "Englisch GK", subject: "en", teachers: [teachers[1]!], semesterId: "s2" },
  { id: "ma-1", name: "Mathematik LK", subject: "ma", teachers: [teachers[2]!], semesterId: "s2" },
  { id: "ph-1", name: "Physik GK", subject: "ph", teachers: [teachers[3]!], semesterId: "s2" },
  { id: "ge-1", name: "Geschichte GK", subject: "ge", teachers: [teachers[0]!], semesterId: "s2" },
  { id: "sp-1", name: "Sport GK", subject: "sp", teachers: [teachers[1]!], semesterId: "s2" },
  { id: "de-0", name: "Deutsch LK", subject: "de", teachers: [teachers[0]!], semesterId: "s1" },
  { id: "ma-0", name: "Mathematik LK", subject: "ma", teachers: [teachers[2]!], semesterId: "s1" },
  { id: "en-0", name: "Englisch GK", subject: "en", teachers: [teachers[1]!], semesterId: "s1" },
  { id: "ge-0", name: "Geschichte GK", subject: "ge", teachers: [teachers[0]!], semesterId: "s1" },
];

const today = new Date();
const monday = addDays(today, -((today.getDay() + 6) % 7));

const makeDate = (dayOffset: number, hours: number, minutes = 0) =>
  set(addDays(monday, dayOffset), { hours, minutes, seconds: 0, milliseconds: 0 });

const timetableSeed: TimetableEntry[] = [
  { id: "tt1", courseId: "ma-1", start: makeDate(0, 8, 0), duration: 80 },
  { id: "tt2", courseId: "de-1", start: makeDate(0, 9, 45), duration: 80 },
  { id: "tt3", courseId: "en-1", start: makeDate(1, 8, 0), duration: 80 },
  { id: "tt4", courseId: "ph-1", start: makeDate(2, 11, 30), duration: 80 },
  { id: "tt5", courseId: "ge-1", start: makeDate(3, 12, 50), duration: 80 },
  { id: "tt6", courseId: "sp-1", start: makeDate(4, 13, 50), duration: 80 },
];

const holidaysSeed: Holiday[] = [
  {
    id: "h-summer-2026",
    name: "Sommerferien",
    start: new Date("2026-07-16T00:00:00"),
    end: new Date("2026-08-26T23:59:59"),
  },
  {
    id: "h-fall-2026",
    name: "Herbstferien",
    start: new Date("2026-10-12T00:00:00"),
    end: new Date("2026-10-24T23:59:59"),
  },
  {
    id: "h-christmas-2026",
    name: "Weihnachtsferien",
    start: new Date("2026-12-23T00:00:00"),
    end: new Date("2027-01-06T23:59:59"),
  },
];

const mockSignatureSvg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 140"><path d="M18 92 C52 40, 84 114, 122 82 S188 40, 224 90 S274 112, 302 64" fill="none" stroke="#111" stroke-width="4" stroke-linecap="round"/><text x="18" y="124" font-size="14" fill="#666">${label}</text></svg>`;

const attachment = (id: string, label: string, color: string): TaskAttachment => ({
  id,
  label,
  color,
});

const gradesSeed: Grade[] = [
  {
    id: "g-master-1",
    courseId: "de-1",
    type: "MASTER",
    result: 11,
    date: addDays(today, -14),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: null,
  },
  {
    id: "g-oral-1",
    courseId: "de-1",
    type: "ORAL",
    result: 12,
    date: addDays(today, -7),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-1",
    courseId: "de-1",
    type: "WRITTEN",
    result: 10,
    date: addDays(today, -28),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-2",
    courseId: "de-1",
    type: "WRITTEN",
    result: 13,
    date: addDays(today, -3),
    teacherSignature: null,
    parentSignature: null,
  },
];

const absencesSeed: Absence[] = [
  {
    id: "a1",
    date: addDays(today, -2),
    courseIds: ["ma-1", "de-1"],
    reason: "Arzttermin",
    parentSignature: null,
    teacherSignature: null,
  },
  {
    id: "a2",
    date: addDays(today, -12),
    courseIds: ["en-1"],
    reason: "Erkältung",
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
    teacherSignature: mockSignatureSvg("T. Kruse"),
  },
];

const tasksSeed: Task[] = [
  {
    id: "task-1",
    courseId: "de-1",
    title: "Gedichtanalyse fertigstellen",
    description:
      "Schreibe die Einleitung und den Hauptteil zu 'Der Panther' aus und markiere drei Stilmittel in deinem Heft.",
    dueDate: addDays(today, 1),
    done: false,
    attachments: [attachment("task-1-a", "Foto 1", "#B9D7F5")],
  },
  {
    id: "task-2",
    courseId: "ma-1",
    title: "Analysis Blatt 7",
    description:
      "Aufgaben 3 bis 6 rechnen und den Rechenweg vollständig notieren. Schwerpunkt: Kurvendiskussion.",
    dueDate: addDays(today, 3),
    done: false,
    attachments: [
      attachment("task-2-a", "Tafelbild", "#F5D9B9"),
      attachment("task-2-b", "Skizze", "#D7E9C6"),
    ],
  },
  {
    id: "task-3",
    courseId: "ph-1",
    title: "Versuchsprotokoll hochladen",
    description:
      "Das Protokoll zum Fadenpendel sauber übertragen und die Messreihe mit Auswertung ergänzen.",
    dueDate: addDays(today, -1),
    done: true,
    attachments: [],
  },
];

const currentSemester = findCurrentSemester(semesters);
const initialCourseIds = coursesSeed
  .filter((course) => course.semesterId === currentSemester?.id)
  .map((course) => course.id);

export function MockAppProvider({ children }: PropsWithChildren) {
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

  const getSemesterCourses = (semesterId: string) =>
    coursesSeed.filter(
      (course) =>
        course.semesterId === semesterId &&
        (selectedCourseIdsBySemester[semesterId] ?? []).includes(course.id),
    );

  const getCourseGrades = (courseId: string) =>
    grades
      .filter((grade) => grade.courseId === courseId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

  const getTask = (taskId: string) => tasks.find((task) => task.id === taskId);

  const getRequiredSetupPath = () => {
    if (!user.licenseKey.trim()) {
      return "/setup/license-key";
    }
    if (!user.name.trim() || !user.yearId || !user.classId) {
      return "/setup/name-and-year";
    }
    if ((selectedCourseIdsBySemester[currentSemester?.id ?? ""] ?? []).length === 0) {
      return "/setup/class-and-courses";
    }
    return null;
  };

  const getActiveHoliday = (date = new Date()) =>
    holidaysSeed.find((holiday) =>
      isWithinInterval(date, {
        start: holiday.start,
        end: holiday.end,
      }),
    );

  const getCourseTasks = (courseId?: string) =>
    tasks
      .filter((task) => (courseId ? task.courseId === courseId : true))
      .sort((a, b) => {
        if (a.done !== b.done) {
          return Number(a.done) - Number(b.done);
        }
        return a.dueDate.getTime() - b.dueDate.getTime();
      });

  const value: MockAppContextValue = {
    user,
    years,
    classes,
    semesters,
    courses: coursesSeed,
    holidays: holidaysSeed,
    timetable: timetableSeed.filter((entry) => {
      const course = getCourse(entry.courseId);
      return course
        ? (selectedCourseIdsBySemester[course.semesterId] ?? []).includes(course.id)
        : false;
    }),
    absences,
    grades,
    tasks,
    getRequiredSetupPath,
    getActiveHoliday,
    getCourse,
    getSemesterCourses,
    getCourseGrades,
    getTask,
    getCourseTasks,
    updateProfile: (patch) => {
      setUser((current) => ({ ...current, ...patch }));
    },
    setSelectedCourses: (semesterId, courseIds) => {
      setSelectedCourseIdsBySemester((current) => ({ ...current, [semesterId]: courseIds }));
    },
    addAbsence: ({ date, courseIds, reason }) => {
      setAbsences((current) => [
        {
          id: `absence-${Date.now()}`,
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
              id: `grade-${Date.now()}`,
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
              id: `grade-${Date.now()}`,
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
              id: `grade-${Date.now()}`,
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
          id: `task-${Date.now()}`,
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
    toggleTaskDone: (taskId) => {
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
      );
    },
    deleteTask: (taskId) => {
      setTasks((current) => current.filter((task) => task.id !== taskId));
    },
  };

  return <MockAppContext.Provider value={value}>{children}</MockAppContext.Provider>;
}

export function useMockApp() {
  const value = useContext(MockAppContext);
  if (!value) {
    throw new Error("Mock app context is missing");
  }
  return value;
}
