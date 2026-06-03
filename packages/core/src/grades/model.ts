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
