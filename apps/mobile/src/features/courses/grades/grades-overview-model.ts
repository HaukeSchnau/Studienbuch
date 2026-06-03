import { groupGradesByType, type Grade } from "@stu/core";

export const getGradesOverviewModel = (grades: Grade[]) => groupGradesByType(grades);
