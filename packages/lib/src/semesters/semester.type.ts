export type SemesterType = "SUMMER" | "WINTER";

export interface Semester {
  name: string;
  start: Date;
  end: Date;
  type: SemesterType;
  year: number;
}
