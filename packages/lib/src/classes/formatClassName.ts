import type { Year } from "../years";
import type { Class } from "./class.type";
import { getCurrentYearNum, isYearActive } from "../years";

export const formatClassName = (
  clazz: Pick<Class, "identifierInYear">,
  year: Pick<Year, "name" | "startYear" | "graduationYear">,
) => {
  if (!isYearActive(year)) {
    return `${year.name} ${clazz.identifierInYear}`;
  }
  const currentYear = getCurrentYearNum(year);
  return `${currentYear}.${clazz.identifierInYear}`;
};
