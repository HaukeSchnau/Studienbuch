import type { Course, Grade } from "@stu/core";

export interface ResolvedGrade extends Grade {
  course: Course;
}

export interface ConfirmedResolvedGrade extends ResolvedGrade {
  teacherSignature: string;
  parentSignature: string | null;
}
