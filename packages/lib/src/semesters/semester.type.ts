export type SemesterType = "SUMMER" | "WINTER";

export interface Semester {
  name: string;
  start: Date;
  end: Date;
  type: SemesterType;
  year: number;
}

export interface SemesterId {
  type: SemesterType;
  year: number;
}
