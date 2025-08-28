import { HttpClient } from "@effect/platform";
import { Database, eq } from "@stu/db";
import { Schools } from "@stu/db/schema";
import { UntisAuth, UntisSchoolYears } from "@stu/external-api";
import { ensureEntityDefined, type SchoolId, simpleDateToDate } from "@stu/lib";
import { Effect, pipe } from "effect";

const login = Effect.fn(function* (school: SchoolId) {
  const db = yield* Database;
  const schoolEntity = yield* db
    .execute((db) => db.query.Schools.findFirst({ where: eq(Schools.id, school) }))
    .pipe(Effect.flatMap(ensureEntityDefined("school", school)));

  return yield* UntisAuth.login(schoolEntity);
});

export const provideUntisAuth = (school: SchoolId) => Effect.provideServiceEffect(HttpClient.HttpClient, login(school));

export const currentSchoolYearId = Effect.gen(function* () {
  const schoolYears = yield* UntisSchoolYears.list;

  const today = new Date();
  let smallestDifference = Number.POSITIVE_INFINITY;
  let closestSchoolYear = null;
  for (const year of schoolYears) {
    const start = simpleDateToDate(year.dateRange.start);
    const end = simpleDateToDate(year.dateRange.end);

    const isCurrentSchoolYear = today >= start && today <= end;
    if (isCurrentSchoolYear) {
      return year.id;
    }

    const difference = Math.abs(start.getTime() - today.getTime());
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestSchoolYear = year;
    }
  }

  return yield* pipe(
    closestSchoolYear,
    ensureEntityDefined(),
    Effect.map((y) => y.id),
  );
});
