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

export const subjectNameMap: Record<SubjectId, string> = {
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
};

export interface TeacherInfo {
  id: string;
  firstName: string;
  lastName: string;
}

export const Teacher = {
  formalName(teacher: TeacherInfo) {
    return `${teacher.firstName} ${teacher.lastName}`;
  },
  formalNameShort(teacher: TeacherInfo) {
    return `${teacher.firstName[0]}. ${teacher.lastName}`;
  },
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

export interface Course {
  id: string;
  name: string;
  subject: SubjectId;
  teachers: TeacherInfo[];
  semesterId: string;
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

export const formatGrade = (result: number) => `${result.toFixed(1).replace(".", ",")} P`;

export const formatGradeShort = (result: number) => `${Math.round(result)}`;

export const isGradeConfirmed = (grade: Grade, isOfAge = false) =>
  Boolean(grade.teacherSignature) && (isOfAge || Boolean(grade.parentSignature));

export const isAbsenceConfirmed = (absence: Absence, isOfAge = false) =>
  Boolean(absence.teacherSignature) && (isOfAge || Boolean(absence.parentSignature));

export const getCurrentYearNum = (year: Year) => year.classLevel;

export const formatYear = (year: Year) => year.name;

export const formatClassName = (schoolClass: SchoolClass, year: Year) =>
  `${year.name} ${schoolClass.identifierInYear}`;

export const findCurrentSemester = (semesters: Semester[]) => semesters.at(-1) ?? semesters[0];
