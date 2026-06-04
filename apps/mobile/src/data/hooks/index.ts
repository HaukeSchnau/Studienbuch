import { useMockDataRuntime } from "../mock/provider";

export const useSessionData = () => {
  const { user, updateProfile } = useMockDataRuntime();

  return { user, updateProfile };
};

export const useSchool = () => {
  const { years, classes, semesters } = useMockDataRuntime();

  return { years, classes, semesters };
};

export const useSetupProgress = () => {
  const { getRequiredSetupPath } = useMockDataRuntime();

  return { getRequiredSetupPath };
};

export const useCourses = () => {
  const { courses, getCourse, getSemesterCourses, setSelectedCourses } = useMockDataRuntime();

  return { courses, getCourse, getSemesterCourses, setSelectedCourses };
};

export const useScheduleData = () => {
  const { holidays, timetable, getActiveHoliday } = useMockDataRuntime();

  return { holidays, timetable, getActiveHoliday };
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

export const useTasks = () => {
  const { tasks, getTask, getCourseTasks, addTask, toggleTaskDone, deleteTask } =
    useMockDataRuntime();

  return { tasks, getTask, getCourseTasks, addTask, toggleTaskDone, deleteTask };
};
