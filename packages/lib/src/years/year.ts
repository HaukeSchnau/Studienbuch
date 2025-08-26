import { Effect } from "effect";
import { YearRepository } from "../repositories";
import type { SchoolId } from "../schools";
import { Semester } from "../semesters";

export interface Year {
  school: SchoolId;
  name: string;
  startYear: number;
  graduationYear: number;
}

// TODO: This logic needs to be more sophisticated instead of just checking the month. Actual semesters from DB should be taken into account.
const getMaxActiveGraduationYear = () => {
  const today = new Date();
  return today.getMonth() >= 7 ? today.getFullYear() + 1 : today.getFullYear();
};

/**
 * @deprecated
 */
export const isYearActive = (year: Pick<Year, "graduationYear">) => {
  return year.graduationYear >= getMaxActiveGraduationYear();
};

export namespace Year {
  export const activeYears = Effect.gen(function* () {
    const semester = yield* Semester.current;
    if (!semester) {
      return [];
    }

    const repo = yield* YearRepository;
    return yield* repo.yearsInSemester(semester);
  });

  export interface Id {
    school: SchoolId;
    startYear: number;
  }
}

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
