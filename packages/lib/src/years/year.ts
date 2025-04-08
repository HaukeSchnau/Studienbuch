import type { SchoolId } from "../schools";

export interface Year {
  school: SchoolId;
  name: string;
  startYear: number;
  graduationYear: number;
}

export interface YearIdentifier {
  school: SchoolId;
  startYear: number;
}

export const getMaxActiveGraduationYear = () => {
  const today = new Date();
  return today.getMonth() >= 7 ? today.getFullYear() + 1 : today.getFullYear();
};

export const isYearActive = (year: Pick<Year, "graduationYear">) => {
  return year.graduationYear >= getMaxActiveGraduationYear();
};

export const getCurrentYearNum = (year: Pick<Year, "startYear">) => {
  const today = new Date();
  const currentYear = today.getFullYear() - year.startYear + 5;

  return today.getMonth() >= 7 ? currentYear : currentYear - 1;
};

export const convertCurrentYearToStartYear = (currentYear: number) => {
  const today = new Date();
  const startYear = today.getFullYear() - currentYear + 5;

  return today.getMonth() >= 7 ? startYear : startYear - 1;
};

export const startYearToNameMap = new Map<number, string>([
  [2012, "Heinrich"],
  [2013, "Paula"],
  [2014, "Otto"],
  [2015, "Clara"],
  [2016, "Hans"],
  [2017, "Lisel"],
  [2018, "Udo"],
  [2019, "Hermine"],
  [2020, "Bernhard"],
  [2021, "Frieda"],
  [2022, "Richard"],
  [2023, "Emmy"],
]);

export const formatYear = (year: Year) => {
  return `${year.name} (Jg. ${getCurrentYearNum(year)})`;
};
