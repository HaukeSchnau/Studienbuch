import type { SubjectId, TeacherInfo } from "../school/model";

export interface Course {
  id: string;
  name: string;
  subject: SubjectId;
  teachers: TeacherInfo[];
  semesterId: string;
}
