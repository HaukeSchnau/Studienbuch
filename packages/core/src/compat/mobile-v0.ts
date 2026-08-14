/**
 * Temporary DTO compatibility for the pre-domain-model mobile application.
 *
 * TODO: Remove this module after the mobile data provider constructs the new
 * CourseOffering, Assessment, AbsenceCase, SchoolTask, and schedule models.
 * New code must import the domain modules instead of this subpath.
 */

export type SubjectId =
  | "de"
  | "en"
  | "ma"
  | "ph"
  | "ch"
  | "bi"
  | "if"
  | "ge"
  | "pw"
  | "mu"
  | "sp"
  | "ku"
  | "re"
  | "wn"
  | "fr"
  | "la"
  | "sn"
  | "sport-theorie"
  | "sf"
  | "tutorium"
  | "ds";

export const subjectNameMap = {
  bi: "Biologie",
  ch: "Chemie",
  de: "Deutsch",
  ds: "Darstellendes Spiel",
  en: "Englisch",
  fr: "Französisch",
  ge: "Geschichte",
  if: "Informatik",
  ku: "Kunst",
  la: "Latein",
  ma: "Mathematik",
  mu: "Musik",
  ph: "Physik",
  pw: "Politik",
  re: "Religion",
  sf: "Seminarfach",
  sn: "Spanisch (neu)",
  sp: "Sport",
  "sport-theorie": "Sporttheorie",
  tutorium: "Tutorium",
  wn: "Werte und Normen",
} satisfies Record<SubjectId, string>;

export interface TeacherInfo {
  id: string;
  firstName: string;
  lastName: string;
}

export const Teacher = {
  formalName: (teacher: TeacherInfo) => `${teacher.firstName} ${teacher.lastName}`,
  formalNameShort: (teacher: TeacherInfo) => `${teacher.firstName[0]}. ${teacher.lastName}`,
};

export interface Year {
  id: string;
  name: string;
  startYear: number;
  classLevel: number;
}

export interface SchoolClass {
  id: string;
  identifierInYear: string;
  startYear: number;
}

export interface Semester {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

export interface UserProfile {
  name: string;
  isOfAge: boolean;
  yearId: string;
  classId: string;
  schoolName: string;
  licenseKey: string;
}

export type CourseLevel = "BASIC" | "ADVANCED";
export type ExamSlot = "P1" | "P2" | "P3" | "P4" | "P5";

export interface Course {
  id: string;
  name: string;
  subject: SubjectId;
  teachers: TeacherInfo[];
  semesterId: string;
  level?: CourseLevel;
  examSlot?: ExamSlot;
}

export interface Holiday {
  id: string;
  name: string;
  start: Date;
  end: Date;
}

export interface TimetableEntry {
  id: string;
  courseId: string;
  start: Date;
  duration: number;
}

export interface Absence {
  id: string;
  date: Date;
  courseIds: string[];
  reason: string;
  parentSignature: string | null;
  teacherSignature: string | null;
}

export type GradeType = "MASTER" | "ORAL" | "WRITTEN";

export interface Grade {
  id: string;
  courseId: string;
  type: GradeType;
  result: number;
  date: Date;
  teacherSignature: string | null;
  parentSignature: string | null;
}

export interface TaskAttachment {
  id: string;
  label: string;
  color: string;
  uri?: string;
}

export interface Task {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: Date;
  done: boolean;
  attachments: TaskAttachment[];
}

export type SetupPath = "/setup/license-key" | "/setup/name-and-year" | "/setup/class-and-courses";

export const isAbsenceConfirmed = (absence: Absence, isOfAge = false) =>
  Boolean(absence.teacherSignature) && (isOfAge || Boolean(absence.parentSignature));

export const groupAbsencesByConfirmation = (absences: Absence[], isOfAge = false) => ({
  excused: absences.filter((absence) => isAbsenceConfirmed(absence, isOfAge)),
  unexcused: absences.filter((absence) => !isAbsenceConfirmed(absence, isOfAge)),
});

export const isGradeConfirmed = (grade: Grade, isOfAge = false) =>
  Boolean(grade.teacherSignature) && (isOfAge || Boolean(grade.parentSignature));

export const getCourseGrades = (grades: Grade[], courseId: string) =>
  [...grades]
    .filter((grade) => grade.courseId === courseId)
    .sort((left, right) => right.date.getTime() - left.date.getTime());

export const groupGradesByType = (grades: Grade[]) => ({
  masterGrades: grades.filter((grade) => grade.type === "MASTER"),
  oralGrades: grades.filter((grade) => grade.type === "ORAL"),
  writtenGrades: grades.filter((grade) => grade.type === "WRITTEN"),
});

export const getMostRecentGradeOfType = (grades: Grade[], type: GradeType) =>
  grades.find((grade) => grade.type === type);

export const formatGrade = (result: number) => `${result.toFixed(1).replace(".", ",")} P`;
export const formatGradeShort = (result: number) => `${Math.round(result)}`;

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

export const getCurrentYearNum = (year: Year) => year.classLevel;
export const formatYear = (year: Year) => year.name;
export const formatClassName = (schoolClass: SchoolClass, year: Year) =>
  `${year.name} ${schoolClass.identifierInYear}`;
export const findCurrentSemester = (semesters: Semester[]) => semesters.at(-1) ?? semesters[0];

export const getRequiredSetupPath = ({
  user,
  currentSemester,
  selectedCourseIdsBySemester,
}: {
  user: UserProfile;
  currentSemester: Semester | undefined;
  selectedCourseIdsBySemester: Record<string, string[]>;
}): SetupPath | null => {
  if (!user.licenseKey.trim()) return "/setup/license-key";
  if (!user.name.trim() || !user.yearId || !user.classId) return "/setup/name-and-year";
  if ((selectedCourseIdsBySemester[currentSemester?.id ?? ""] ?? []).length === 0) {
    return "/setup/class-and-courses";
  }
  return null;
};

const archivalWindowMs = 7 * 24 * 60 * 60 * 1000;

export const isTaskArchived = (task: Task, now = new Date()) =>
  task.done || task.dueDate.getTime() + archivalWindowMs < now.getTime();

export const getCourseTasks = (tasks: Task[], courseId?: string) =>
  [...tasks]
    .filter((task) => (courseId ? task.courseId === courseId : true))
    .sort((left, right) => {
      if (left.done !== right.done) return Number(left.done) - Number(right.done);
      return left.dueDate.getTime() - right.dueDate.getTime();
    });
