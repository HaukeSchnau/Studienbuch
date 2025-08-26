import type { SubjectId } from "./courses";
import type { Teacher } from "./teacher";

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

export interface AbsenceDayWithTeachers {
  date: Date;
  reason: string;
  absenceCourses: {
    teacherSignature: string | null;
    course: {
      id: string;
      subject: SubjectId;
      teachers: Teacher[];
    };
  }[];
  parentSignature: string | null;
}
