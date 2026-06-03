import type { Semester } from "./model";

export const findCurrentSemester = (semesters: Semester[]) => semesters.at(-1) ?? semesters[0];
