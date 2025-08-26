import { Effect } from "effect";
import type { SchoolId } from "./school";
import { getCurrentYearNum, isYearActive, Year } from "./year";

export interface Class {
  identifierInYear: string;
  startYear: number;
  school: SchoolId;
}

export namespace Class {
  export const formatName = Effect.fn(function* (clazz: Class, year: Year) {
    if (!(yield* Year.isActive(year))) {
      return `${year.name} ${clazz.identifierInYear}`.trim();
    }

    const currentYear = yield* Year.currentYearNum(year);
    if (!clazz.identifierInYear) {
      return `${currentYear}`;
    }

    return `${currentYear}.${clazz.identifierInYear}`;
  });
}

/**
 * @deprecated
 */
export const formatClassName = (
  clazz: Pick<Class, "identifierInYear">,
  year: Pick<Year, "name" | "startYear" | "graduationYear">,
) => {
  if (!isYearActive(year)) {
    return `${year.name} ${clazz.identifierInYear}`.trim();
  }

  const currentYear = getCurrentYearNum(year);

  if (!clazz.identifierInYear) {
    return `${currentYear}`;
  }

  return `${currentYear}.${clazz.identifierInYear}`;
};
