import type { Course, WithTeachers } from "@stu/lib";

export interface Grade {
  teacherSignature: string | null;
  parentSignature: string | null;
  result: number;
  date: Date;
  course: Course & WithTeachers;
}

export interface ConfirmedGrade {
  teacherSignature: string;
  parentSignature: string;
  result: number;
  date: Date;
  course: Course & WithTeachers;
}
