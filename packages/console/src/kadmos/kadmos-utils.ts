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
  const schoolYears = await getSchoolYears(authContext);

  const today = new Date();
  const currentSchoolYear = schoolYears.find((year) => {
    const start = simpleDateToDate(year.dateRange.start);
    const end = simpleDateToDate(year.dateRange.end);
    return today >= start && today <= end;
  });

  if (!currentSchoolYear) {
    console.warn(
      `No current school year found. Available school years: ${schoolYears.map((year) => year.name).join(", ")}. Using last available year.`,
    );
    const lastSchoolYear = schoolYears[schoolYears.length - 1];
    if (!lastSchoolYear) {
      throw new Error("No school years found");
    }
    return lastSchoolYear.id;
  }

  return currentSchoolYear.id;
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
