import {
  formatGradeShort,
  isGradeConfirmed,
  type Course,
  type ExamSlot,
  type Grade,
  type GradeType,
  type Task,
} from "@stu/core";
import { differenceInCalendarDays } from "date-fns";

const examSlotOrder = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
} satisfies Record<ExamSlot, number>;

export interface ProfileCourseSignal {
  course: Course;
  primaryGrade?: {
    label: "Gesamt" | "Tendenz";
    value: string;
  };
  oralGrade?: string;
  writtenGrade?: string;
  taskSignal?: string;
}

export interface ProfileCoursesModel {
  examCourses: ProfileCourseSignal[];
  featuredExamCourses: ProfileCourseSignal[];
  compactExamCourses: ProfileCourseSignal[];
  regularCourses: ProfileCourseSignal[];
}

const latestGrade = (grades: Grade[], type: GradeType) =>
  grades
    .filter((grade) => grade.type === type)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

const averageGrade = (grades: Grade[], type: GradeType) => {
  const typedGrades = grades.filter((grade) => grade.type === type);
  if (typedGrades.length === 0) {
    return undefined;
  }

  return typedGrades.reduce((total, grade) => total + grade.result, 0) / typedGrades.length;
};

const formatShortPoints = (value: number) => `${formatGradeShort(value)} P`;

const getTaskSignal = (tasks: Task[], today: Date) => {
  const openTasks = tasks
    .filter((task) => !task.done)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const nextTask = openTasks[0];
  if (!nextTask) {
    return undefined;
  }

  const dueInDays = differenceInCalendarDays(nextTask.dueDate, today);

  if (dueInDays < 0) {
    return "überfällig";
  }
  if (dueInDays === 0) {
    return "heute fällig";
  }
  if (dueInDays === 1) {
    return "morgen fällig";
  }

  return `${openTasks.length} ${openTasks.length === 1 ? "Aufgabe" : "Aufgaben"}`;
};

const buildSignal = ({
  course,
  grades,
  tasks,
  today,
  isOfAge,
}: {
  course: Course;
  grades: Grade[];
  tasks: Task[];
  today: Date;
  isOfAge: boolean;
}): ProfileCourseSignal => {
  const masterGrade = latestGrade(grades, "MASTER");
  const oralGrade = latestGrade(grades, "ORAL");
  const writtenAverage = averageGrade(grades, "WRITTEN");

  return {
    course,
    primaryGrade: masterGrade
      ? {
          label: isGradeConfirmed(masterGrade, isOfAge) ? "Gesamt" : "Tendenz",
          value: formatShortPoints(masterGrade.result),
        }
      : undefined,
    oralGrade: oralGrade ? formatGradeShort(oralGrade.result) : undefined,
    writtenGrade: writtenAverage !== undefined ? formatGradeShort(writtenAverage) : undefined,
    taskSignal: getTaskSignal(tasks, today),
  };
};

export const getProfileCoursesModel = ({
  courses,
  getCourseGrades,
  getCourseTasks,
  today = new Date(),
  isOfAge = false,
}: {
  courses: Course[];
  getCourseGrades: (courseId: string) => Grade[];
  getCourseTasks: (courseId: string) => Task[];
  today?: Date;
  isOfAge?: boolean;
}): ProfileCoursesModel => {
  const signals = courses.map((course) =>
    buildSignal({
      course,
      grades: getCourseGrades(course.id),
      tasks: getCourseTasks(course.id),
      today,
      isOfAge,
    }),
  );

  const examCourses = signals
    .filter((signal) => signal.course.examSlot)
    .sort(
      (a, b) =>
        examSlotOrder[a.course.examSlot!] - examSlotOrder[b.course.examSlot!] ||
        a.course.name.localeCompare(b.course.name, "de"),
    );

  return {
    examCourses,
    featuredExamCourses: examCourses.filter(
      (signal) => signal.course.examSlot === "P1" || signal.course.examSlot === "P2",
    ),
    compactExamCourses: examCourses.filter(
      (signal) => signal.course.examSlot !== "P1" && signal.course.examSlot !== "P2",
    ),
    regularCourses: signals
      .filter((signal) => !signal.course.examSlot)
      .sort((a, b) => a.course.name.localeCompare(b.course.name, "de")),
  };
};
