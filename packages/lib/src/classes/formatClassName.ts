import type { Year } from "../years";
import { getCurrentYearNum, isYearActive } from "../years";
import type { Class } from "./class.type";

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
