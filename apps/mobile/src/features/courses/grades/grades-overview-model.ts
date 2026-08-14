import { groupGradesByType, type Grade } from "@stu/core/compat/mobile-v0";

export const getGradesOverviewModel = (grades: Grade[]) => groupGradesByType(grades);
