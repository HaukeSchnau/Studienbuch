import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { getBearerToken, getSchoolYears, login } from "@stu/external-api";
import { type SchoolId, simpleDateToDate } from "@stu/lib";
import type { CookieJar } from "tough-cookie";

export interface AuthContext {
  jar: CookieJar;
  bearerToken: string;
}

export const setupAuth = async (school: SchoolId): Promise<AuthContext> => {
  const schoolEntity = await db.query.Schools.findFirst({
    where: eq(Schools.id, school),
  });
  if (!schoolEntity) throw new Error(`School ${school} not found`);

  const { kadmosName, kadmosUsername, kadmosPassword } = schoolEntity;

  const jar = await login(kadmosName, kadmosUsername, kadmosPassword);
  const bearerToken = await getBearerToken(jar);

  return { jar, bearerToken };
};

export const getCurrentSchoolYearId = async (authContext: AuthContext): Promise<number> => {
  const schoolYears = await getSchoolYears(authContext).then((years) =>
    years.map((year) => ({
      ...year,
      start: simpleDateToDate(year.dateRange.start),
      end: simpleDateToDate(year.dateRange.end),
    })),
  );

  const today = new Date();
  let smallestDifference = Number.POSITIVE_INFINITY;
  let closestSchoolYear = null;
  for (const year of schoolYears) {
    const isCurrentSchoolYear = today >= year.start && today <= year.end;
    if (isCurrentSchoolYear) {
      return year.id;
    }

    const difference = Math.abs(year.start.getTime() - today.getTime());
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestSchoolYear = year;
    }
  }
  if (!closestSchoolYear) {
    throw new Error("No school years found");
  }
  return closestSchoolYear.id;
};

export const getBroadRange = () => {
  const today = new Date();
  const start = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
  const end = {
    year: today.getFullYear() + 1,
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
  return { start, end };
};
