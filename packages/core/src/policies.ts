import type { Absence, Grade, Task } from "./model";

const archivalWindowMs = 7 * 24 * 60 * 60 * 1000;

export const isGradeConfirmed = (grade: Grade, isOfAge = false) =>
  Boolean(grade.teacherSignature) && (isOfAge || Boolean(grade.parentSignature));

export const isAbsenceConfirmed = (absence: Absence, isOfAge = false) =>
  Boolean(absence.teacherSignature) && (isOfAge || Boolean(absence.parentSignature));

export const isTaskArchived = (task: Task, now = new Date()) =>
  task.done || task.dueDate.getTime() + archivalWindowMs < now.getTime();
