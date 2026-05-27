import type { Course, Grade } from "~/mock-app/domain";

export interface ResolvedGrade extends Grade {
  course: Course;
}

export interface ConfirmedResolvedGrade extends ResolvedGrade {
  teacherSignature: string;
  parentSignature: string | null;
}
