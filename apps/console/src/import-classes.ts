import type { SchoolId } from "@stu/lib";
import { ingest, SYSTEM_USER } from "@stu/api";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { getClasses, login } from "@stu/external-api";
import { BetterMap, Result, startYearToNameMap } from "@stu/lib";

import { ConsoleIservClient } from "./get-or-create-teacher";
import { logger } from "./logger";
import { mapKadmosClass } from "./map-kadmos-class";

interface Options {
  school: SchoolId;
}

export const importClasses = async ({ school }: Options) => {
  logger.info(`Importing classes for school "${school}"...`);

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

  const iservClient = new ConsoleIservClient();

  for (const year of years) {
    const classesInYear = classes.filter(
      (cls) => cls.startYear === year.startYear,
    );

    // make sure that classes are unique by identifierInYear
    const classesInYearUnique = classesInYear.filter(
      (cls, index, self) =>
        index ===
        self.findIndex(
          (otherCls) => otherCls.identifierInYear === cls.identifierInYear,
        ),
    );

    const name =
      startYearToNameMap.get(year.startYear) ??
      year.name ??
      year.startYear.toString();

    // if (!name) {
    //   logger.error(`Could not find name for year ${year.startYear}`);
    //   continue;
    // }

    const err = await ingest(
      "org.year.started",
      {
        data: {
          name,
          graduationYear: year.startYear + 9,
          startYear: year.startYear,
          school,
          classes: await Promise.all(
            classesInYearUnique.map(async (cls) => ({
              identifierInYear: cls.identifierInYear,
              teachers: await Promise.all(
                cls.teachers.map((teacher) =>
                  iservClient.getOrCreateTeacher(teacher),
                ),
              ),
            })),
          ),
        },
        id: crypto.randomUUID(),
        timestamp: new Date(),
      },
      SYSTEM_USER,
    );

    if (Result.isErr(err)) {
      if (err.error === "EXISTS") {
        logger.debug(`Year ${name} already started!`);
      } else {
        logger.error(`Could not ingest year started event: ${err.error}`);
      }
    } else {
      logger.info(`Year ${name} started!`);
    }
  }
};
