import type { SubjectId, TeacherInfo } from "../school/model";

export type CourseLevel = "BASIC" | "ADVANCED";

export type ExamSlot = "P1" | "P2" | "P3" | "P4" | "P5";

export interface Course {
  id: string;
  name: string;
  subject: SubjectId;
  teachers: TeacherInfo[];
  semesterId: string;
  level?: CourseLevel;
  examSlot?: ExamSlot;
}
