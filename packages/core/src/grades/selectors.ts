import type { Grade, GradeType } from "./model";

export const getCourseGrades = (grades: Grade[], courseId: string) =>
  [...grades]
    .filter((grade) => grade.courseId === courseId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

export const groupGradesByType = (grades: Grade[]) => ({
  masterGrades: grades.filter((grade) => grade.type === "MASTER"),
  oralGrades: grades.filter((grade) => grade.type === "ORAL"),
  writtenGrades: grades.filter((grade) => grade.type === "WRITTEN"),
});

export const getMostRecentGradeOfType = (grades: Grade[], type: GradeType) =>
  grades.find((grade) => grade.type === type);
