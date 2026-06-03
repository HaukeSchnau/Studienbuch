import type { SchoolClass, Year } from "./model";

export const getCurrentYearNum = (year: Year) => year.classLevel;

export const formatYear = (year: Year) => year.name;

export const formatClassName = (schoolClass: SchoolClass, year: Year) =>
  `${year.name} ${schoolClass.identifierInYear}`;
