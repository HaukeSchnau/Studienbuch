import type { Absence } from "@stu/lib";

export interface AbsenceGroup {
  date: Date;
  reason: string;
  isExcusedByTeacher: boolean;
  isExcusedByParent: boolean;

  absences: Absence[];
}
