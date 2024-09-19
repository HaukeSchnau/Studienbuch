import type { SubjectId } from "../courses";

export interface Absence {
  date: Date;
  reason: string;
  course: {
    id: string;
    subject: SubjectId;
  };
  teacherSignature: string | null;
  parentSignature: string | null;
}
