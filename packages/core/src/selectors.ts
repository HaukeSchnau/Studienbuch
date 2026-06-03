import type {
  Absence,
  Course,
  Grade,
  GradeType,
  Holiday,
  Semester,
  SetupPath,
  Task,
  TimetableEntry,
  UserProfile,
} from "./model";
import { isAbsenceConfirmed } from "./policies";

export const findCurrentSemester = (semesters: Semester[]) => semesters.at(-1) ?? semesters[0];

export const getSelectedSemesterCourses = (
  courses: Course[],
  semesterId: string,
  selectedCourseIdsBySemester: Record<string, string[]>,
) =>
  courses.filter(
    (course) =>
      course.semesterId === semesterId &&
      (selectedCourseIdsBySemester[semesterId] ?? []).includes(course.id),
  );

export const getCourseGrades = (grades: Grade[], courseId: string) =>
  [...grades]
    .filter((grade) => grade.courseId === courseId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

export const getCourseTasks = (tasks: Task[], courseId?: string) =>
  [...tasks]
    .filter((task) => (courseId ? task.courseId === courseId : true))
    .sort((a, b) => {
      if (a.done !== b.done) {
        return Number(a.done) - Number(b.done);
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

export const getVisibleTimetable = (
  timetable: TimetableEntry[],
  courses: Course[],
  selectedCourseIdsBySemester: Record<string, string[]>,
) =>
  timetable.filter((entry) => {
    const course = courses.find((item) => item.id === entry.courseId);
    return course
      ? (selectedCourseIdsBySemester[course.semesterId] ?? []).includes(course.id)
      : false;
  });

export const getActiveHoliday = (holidays: Holiday[], date = new Date()) =>
  holidays.find((holiday) => date >= holiday.start && date <= holiday.end);

export const getRequiredSetupPath = ({
  user,
  currentSemester,
  selectedCourseIdsBySemester,
}: {
  user: UserProfile;
  currentSemester: Semester | undefined;
  selectedCourseIdsBySemester: Record<string, string[]>;
}): SetupPath | null => {
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

export const groupAbsencesByConfirmation = (absences: Absence[], isOfAge = false) => ({
  excused: absences.filter((absence) => isAbsenceConfirmed(absence, isOfAge)),
  unexcused: absences.filter((absence) => !isAbsenceConfirmed(absence, isOfAge)),
});

export const groupGradesByType = (grades: Grade[]) => ({
  masterGrades: grades.filter((grade) => grade.type === "MASTER"),
  oralGrades: grades.filter((grade) => grade.type === "ORAL"),
  writtenGrades: grades.filter((grade) => grade.type === "WRITTEN"),
});

export const getMostRecentGradeOfType = (grades: Grade[], type: GradeType) =>
  grades.find((grade) => grade.type === type);
