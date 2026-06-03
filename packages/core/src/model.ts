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

export interface Holiday {
  id: string;
  name: string;
  start: Date;
  end: Date;
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

export interface TaskAttachment {
  id: string;
  label: string;
  color: string;
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

export interface UserProfile {
  name: string;
  isOfAge: boolean;
  yearId: string;
  classId: string;
  schoolName: string;
  licenseKey: string;
}

export type SetupPath = "/setup/license-key" | "/setup/name-and-year" | "/setup/class-and-courses";
