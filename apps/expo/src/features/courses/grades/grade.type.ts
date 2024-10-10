import type { Course } from "@stu/lib";

export interface Grade {
  teacherSignature: string | null;
  parentSignature: string | null;
  result: number;
  date: Date;
  course: Course & { longName: string };
}

export interface ConfirmedGrade {
  teacherSignature: string;
  parentSignature: string;
  result: number;
  date: Date;
  course: Course & { longName: string };
}
