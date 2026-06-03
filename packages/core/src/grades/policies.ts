import type { Grade } from "./model";

export const isGradeConfirmed = (grade: Grade, isOfAge = false) =>
  Boolean(grade.teacherSignature) && (isOfAge || Boolean(grade.parentSignature));
