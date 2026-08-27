import type { Course, Grade } from "~/compat/mobile-v0";

export interface ResolvedGrade extends Grade {
  course: Course;
}

export interface ConfirmedResolvedGrade extends ResolvedGrade {
  teacherSignature: string;
  parentSignature: string | null;
}
