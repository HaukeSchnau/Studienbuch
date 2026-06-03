import { useMockRuntime } from "../provider";

export const useMockSession = () => {
  const { user, updateProfile } = useMockRuntime();

  return { user, updateProfile };
};

export const useMockSchool = () => {
  const { years, classes, semesters } = useMockRuntime();

  return { years, classes, semesters };
};

export const useMockSetup = () => {
  const { getRequiredSetupPath } = useMockRuntime();

  return { getRequiredSetupPath };
};

export const useMockCourses = () => {
  const { courses, getCourse, getSemesterCourses, setSelectedCourses } = useMockRuntime();

  return { courses, getCourse, getSemesterCourses, setSelectedCourses };
};

export const useMockSchedule = () => {
  const { holidays, timetable, getActiveHoliday } = useMockRuntime();

  return { holidays, timetable, getActiveHoliday };
};

export const useMockAbsences = () => {
  const { absences, addAbsence, deleteAbsence, signAbsence } = useMockRuntime();

  return { absences, addAbsence, deleteAbsence, signAbsence };
};

export const useMockGrades = () => {
  const { grades, getCourseGrades, upsertGrade, signGrade, restoreLatestConfirmedGrade } =
    useMockRuntime();

  return { grades, getCourseGrades, upsertGrade, signGrade, restoreLatestConfirmedGrade };
};

export const useMockTasks = () => {
  const { tasks, getTask, getCourseTasks, addTask, toggleTaskDone, deleteTask } = useMockRuntime();

  return { tasks, getTask, getCourseTasks, addTask, toggleTaskDone, deleteTask };
};
