import type { SchoolClass, Year } from "./model";

export const formatGrade = (result: number) => `${result.toFixed(1).replace(".", ",")} P`;

export const formatGradeShort = (result: number) => `${Math.round(result)}`;

export const getCurrentYearNum = (year: Year) => year.classLevel;

export const formatYear = (year: Year) => year.name;

export const formatClassName = (schoolClass: SchoolClass, year: Year) =>
  `${year.name} ${schoolClass.identifierInYear}`;
