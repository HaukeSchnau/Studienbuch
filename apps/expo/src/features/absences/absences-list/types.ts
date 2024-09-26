import type { SubjectId } from "@stu/lib";

export interface AbsenceItem {
  date: Date;
  reason: string;
  courses: {
    id: string;
    subject: SubjectId;
  }[];
  isExcusedByTeacher: boolean;
  isExcusedByParent: boolean;
}
