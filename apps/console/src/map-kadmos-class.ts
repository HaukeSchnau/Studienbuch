import type { KadmosClassResponse } from "@stu/external-api";
import { convertCurrentYearToStartYear } from "@stu/lib";

const extractTeachersAbbrvs = (longName: string) => {
  const abbrvs = longName.trim().split("/");
  return abbrvs.filter((abbrv) => abbrv.length === 3);
};

const isTeachersAbbrvString = (longName: string) => {
  const regex = /^([A-ZÄÖÜ]{3})(\/[A-ZÄÖÜ]{3})*$/i;
  return regex.test(longName);
};

const extractYearNum = (name: string) => {
  const yearStr = name.split(".")[0];
  if (!yearStr) throw new Error("couldnt extract year num from " + name);

  return parseInt(yearStr);
};

export const mapKadmosClass = ({
  name,
  longName,
  id,
}: KadmosClassResponse[number]) => ({
  id,
  startYear: convertCurrentYearToStartYear(extractYearNum(name)),
  yearName: isTeachersAbbrvString(longName) ? null : longName,
  identifierInYear: name.split(".")[1] ?? "",
  teachers: extractTeachersAbbrvs(longName),
});
