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

export interface UserProfile {
  name: string;
  isOfAge: boolean;
  yearId: string;
  classId: string;
  schoolName: string;
  licenseKey: string;
}
