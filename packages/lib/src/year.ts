import { Context, Effect } from "effect";
import type { UnknownDatabaseError } from "./repositories";
import type { SchoolId } from "./school";
import { Semester } from "./semesters";

export interface Year {
  school: SchoolId;
  name: string;
  startYear: number;
  graduationYear: number;
}

export namespace Year {
  export interface Id {
    school: SchoolId;
    startYear: number;
  }

  export const activeYears = Effect.gen(function* () {
    const semester = yield* Semester.current;
    if (!semester) {
      return [];
    }

    const repo = yield* YearRepository;
    return yield* repo.yearsInSemester(semester);
  });

  export const isActive = Effect.fn(function* (year: Year) {
    const currentYearNum = yield* Year.currentYearNum(year);
    return currentYearNum >= year.startYear && currentYearNum <= year.graduationYear;
  });

  const INITIAL_YEAR_NUM = 5; // TODO: We currently only support schools that start at year 5. If we support e.g. elementary schools, we need to encode this in the year itself.

  export const currentYearNum = Effect.fn(function* (year: Year) {
    const semester = yield* Semester.current;
    if (!semester) return getCurrentYearNum(year); // Fallback to old logic if no semester is available. TODO: Remove this fallback.

    if (semester.type === "WINTER") {
      return INITIAL_YEAR_NUM + semester.year - year.startYear;
    }

    return INITIAL_YEAR_NUM + semester.year - year.startYear - 1;
  });

  export const currentYearToStartYear = Effect.fn(function* (currentYear: number) {
    const semester = yield* Semester.current;
    if (!semester) return convertCurrentYearToStartYear(currentYear); // Fallback to old logic if no semester is available. TODO: Remove this fallback.

    if (semester.type === "WINTER") {
      return semester.year - currentYear + INITIAL_YEAR_NUM;
    }

    return semester.year - currentYear + INITIAL_YEAR_NUM - 1;
  });

  const startYearToNameMap = new Map<number, string>([
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

  export const getYearName = (year: { startYear: number }) => startYearToNameMap.get(year.startYear);
}

export class YearRepository extends Context.Tag("YearRepository")<
  YearRepository,
  {
    yearsInSemester: (semester: Semester) => Effect.Effect<Year[], UnknownDatabaseError>;

    doesYearExist: (payload: Year.Id) => Effect.Effect<boolean, UnknownDatabaseError>;

    getYear: (payload: Year.Id) => Effect.Effect<Year | undefined, UnknownDatabaseError>;

    getAllYears: (payload: { school?: SchoolId }) => Effect.Effect<Year[], UnknownDatabaseError>;

    createYear: (
      payload: Year & {
        classes: { identifierInYear: string; teachers: string[] }[];
      },
    ) => Effect.Effect<void, UnknownDatabaseError>;
  }
>() {}

/**
 * @deprecated
 */
export const getCurrentYearNum = (year: Pick<Year, "startYear">) => {
  const today = new Date();
  const currentYear = today.getFullYear() - year.startYear + 5;

  return today.getMonth() >= 7 ? currentYear : currentYear - 1;
};

/**
 * @deprecated
 */
export const convertCurrentYearToStartYear = (currentYear: number) => {
  const today = new Date();
  const startYear = today.getFullYear() - currentYear + 5;

  return today.getMonth() >= 7 ? startYear : startYear - 1;
};

/**
 * @deprecated
 */
export const formatYear = (year: Year) => {
  return `${year.name} (Jg. ${getCurrentYearNum(year)})`;
};

/**
 * @deprecated
 */
export const isYearActive = (year: Pick<Year, "graduationYear">) => {
  const today = new Date();
  const maxActiveGraduationYear = today.getMonth() >= 7 ? today.getFullYear() + 1 : today.getFullYear();
  return year.graduationYear >= maxActiveGraduationYear;
};
