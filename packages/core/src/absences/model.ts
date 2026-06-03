export interface Absence {
  id: string;
  date: Date;
  courseIds: string[];
  reason: string;
  parentSignature: string | null;
  teacherSignature: string | null;
}
