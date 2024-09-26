import type { SubjectId } from "../courses";

export interface AbsenceDay {
  date: Date;
  reason: string;
  absenceCourses: {
    teacherSignature: string | null;
    course: {
      id: string;
      subject: SubjectId;
    };
  }[];
  parentSignature: string | null;
}
