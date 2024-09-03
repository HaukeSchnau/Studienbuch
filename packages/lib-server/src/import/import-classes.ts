import type { SchoolId } from "@stu/lib";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Classes, Schools, TeachersToClasses, Years } from "@stu/db/schema";
import { getClasses, login } from "@stu/external-api";
import { BetterMap, startYearToNameMap } from "@stu/lib";
import {mapKadmosClass} from './map-kadmos-class'

import { createLazyIservClient } from "../lazy-iserv-client";

interface Options {
  school: SchoolId;
}

export const importClasses = async ({ school }: Options) => {
  const schoolEntity = await db.query.Schools.findFirst({
    where: eq(Schools.id, school),
  });
  if (!schoolEntity) throw new Error(`School ${school} not found`);

  const { kadmosName, kadmosUsername, kadmosPassword } = schoolEntity;

  const jar = await login(kadmosName, kadmosUsername, kadmosPassword);
  const kadmosClasses = await getClasses(jar);

  const classes = kadmosClasses.map(mapKadmosClass);

  const years = BetterMap.uniqueFromValues(
    classes.map(({ startYear, yearName }) => ({
      startYear,
      name: yearName,
    })),
    "startYear",
  ).values();

  for (const year of years) {
    const dbValues: typeof Years.$inferInsert = {
      name:
        startYearToNameMap.get(year.startYear) ??
        year.name ??
        year.startYear.toString(),
      graduationYear: year.startYear + 8,
      startYear: year.startYear,
      school,
    };
    await db
      .insert(Years)
      .values(dbValues)
      .onConflictDoUpdate({
        target: [Years.startYear, Years.school],
        set: {
          name: dbValues.name,
          graduationYear: dbValues.graduationYear,
        },
      });
  }

  const iservClient = createLazyIservClient();

  for (const cls of classes) {
    const dbValues: typeof Classes.$inferInsert = {
      identifierInYear: cls.identifierInYear,
      startYear: cls.startYear,
      school,
    };
    await db.insert(Classes).values(dbValues).onConflictDoNothing();

    for (const teacher of cls.teachers) {
      const personId = await iservClient.getOrCreatePerson(teacher);
      await db
        .insert(TeachersToClasses)
        .values({
          teacher: personId,
          classIdentifier: cls.identifierInYear,
          classStartYear: cls.startYear,
          school,
        })
        .onConflictDoNothing();
    }
  }
};
