import { groupGradesByType, type Grade } from "~/compat/mobile-v0";

export const getGradesOverviewModel = (grades: Grade[]) => groupGradesByType(grades);
